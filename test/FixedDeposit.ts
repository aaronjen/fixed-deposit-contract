import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FixedDeposit Contract", function () {
    it("Deployment should set deposit cap", async function() {
        const [owner, user] = await ethers.getSigners();
        const hardcap = 1e4
        const FixedDeposit = await ethers.getContractFactory("FixedDeposit").then(f => f.deploy(hardcap));

        expect(await FixedDeposit.depositHardCap()).to.equal(hardcap);

        await expect(FixedDeposit.connect(user).setDepositCapForAll(100)).to.be.revertedWith("UNAUTHORIZED");

        expect(await FixedDeposit.connect(owner).setDepositCapForAll(100))
            .to.emit(FixedDeposit, "SetDepositCapForAll")
            .withArgs(100);

        expect(await FixedDeposit.depositHardCap()).to.equal(100);
    });

    it("should be limited by deposit hard cap", async function() {
        const [owner, user] = await ethers.getSigners();

        const hardcap = ethers.utils.parseEther("100");
        const FixedDeposit = await ethers.getContractFactory("FixedDeposit").then(f => f.deploy(hardcap));

        await expect(FixedDeposit.connect(user).fixedDeposit(0, {
            value: ethers.utils.parseEther("1000"),
        })).to.be.revertedWith("reach total deposit cap")

        expect(await FixedDeposit.balance()).to.equal(ethers.utils.parseEther("0"));

        await FixedDeposit.setDepositCapForAddress(user.address, ethers.utils.parseEther("10"))

        await expect(FixedDeposit.connect(user).fixedDeposit(0, {
            value: ethers.utils.parseEther("20"),
        })).to.be.revertedWith("reach user deposit cap");
    });

    it("user should deposit and withdraw", async function() {
        const [owner, user1, user2] = await ethers.getSigners();
        const hardcap = ethers.utils.parseEther("100");
        const FixedDeposit = await ethers.getContractFactory("FixedDeposit").then(f => f.deploy(hardcap));
        const depositId1 = 0;
        const depositId2 = 1;

        // initial funding
        await owner.sendTransaction({
            to: FixedDeposit.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 200000
        })

        expect(await FixedDeposit.connect(user1).fixedDeposit(5, {
            value: ethers.utils.parseEther("10"),
        })).to.emit(FixedDeposit, "UserDeposit")
        .withArgs(depositId1, user1.address, 5, ethers.utils.parseEther("10"))
        .changeEtherBalances([FixedDeposit.address, user1.address], [ethers.utils.parseEther("10"), ethers.utils.parseEther("-10")]);

        expect(await FixedDeposit.connect(user2).fixedDeposit(5, {
            value: ethers.utils.parseEther("10"),
        })).to.emit(FixedDeposit, "UserDeposit")
        .withArgs(depositId2, user2.address, 5, ethers.utils.parseEther("10"))
        .changeEtherBalances([FixedDeposit.address, user2.address], [ethers.utils.parseEther("10"), ethers.utils.parseEther("-10")]);

        await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]); // add 1 year
        await ethers.provider.send("evm_mine", []);

        await expect(FixedDeposit.connect(user2).userWithdrawInterest(depositId1))
            .to.be.revertedWith("sender should be deposit user")
        
        await expect(FixedDeposit.connect(user1).userWithdrawInterest(depositId1))
            .to.emit(FixedDeposit, "UserWithdrawInterest")
            .withArgs(depositId1, user1.address, ethers.utils.parseEther("3"))
            .changeEtherBalances([FixedDeposit.address, user1.address], [ethers.utils.parseEther("-3"), ethers.utils.parseEther("3")])

        await expect(FixedDeposit.connect(user1).userCloseDeposit(depositId1))
            .to.emit(FixedDeposit, "UserCloseDeposit")
            .withArgs(depositId1, user1.address, ethers.utils.parseEther("10"))
            .changeEtherBalances([FixedDeposit.address, user1.address], [ethers.utils.parseEther("-10"), ethers.utils.parseEther("10")])

        await expect(FixedDeposit.connect(user2).userCloseDeposit(depositId2))
            .to.emit(FixedDeposit, "UserCloseDeposit")
            .withArgs(depositId2, user2.address, ethers.utils.parseEther("13"))
            .changeEtherBalances([FixedDeposit.address, user2.address], [ethers.utils.parseEther("-13"), ethers.utils.parseEther("13")])
    })

    it("deposit should have interest", async function() {
        const [owner, user] = await ethers.getSigners();
        const hardcap = ethers.utils.parseEther("10000")
        const FixedDeposit = await ethers.getContractFactory("FixedDeposit").then(f => f.deploy(hardcap))

        type testCase = {
            principalInEth: string;
            duration: number;
            time: number;
            interestInEth: string;
        }

        const day = 24 * 60 * 60

        const testcases: testCase[] = [
            {
                principalInEth: "100",
                duration: 0,
                time: 1 * day,
                interestInEth: "0.000027397260273972"
            },
            {
                principalInEth: "100",
                duration: 1,
                time: 7 * day,
                interestInEth: "0.001917808219178082"
            },
            {
                principalInEth: "100",
                duration: 2,
                time: 30 * day,
                interestInEth: "0.057534246575342465",
            },
            {
                principalInEth: "100",
                duration: 3,
                time: 90 * day,
                interestInEth: "0.616438356164383561",
            },
            {
                principalInEth: "100",
                duration: 4,
                time: 180 * day,
                interestInEth: "4.931506849315068493",
            },
            {
                principalInEth: "100",
                duration: 5,
                time: 365 * day,
                interestInEth: "30",
            }
        ]

        for (let index = 0; index < testcases.length; index++) {
            const t = testcases[index];
            await FixedDeposit.connect(user).fixedDeposit(t.duration, {
                value: ethers.utils.parseEther(t.principalInEth),
            })

            await ethers.provider.send("evm_increaseTime", [t.time])
            await ethers.provider.send("evm_mine", []),

            expect(await FixedDeposit.getDepositInterest(index))
                .to.equal(ethers.utils.parseEther(t.interestInEth))
        }
    })

    it("user can't open deposit over 16", async function() {
        const [owner, user] = await ethers.getSigners();

        const hardcap = ethers.utils.parseEther("10000")
        const FixedDeposit = await ethers.getContractFactory("FixedDeposit").then(f => f.deploy(hardcap));

        for (let index = 0; index < 16; index++) {
            await expect(FixedDeposit.connect(user).fixedDeposit(5, {
                value: ethers.utils.parseEther("1"),
            })).emit(FixedDeposit, "UserDeposit")
            .withArgs(index, user.address, 5, ethers.utils.parseEther("1"))
            
        }

        await expect(FixedDeposit.connect(user).fixedDeposit(5, {
            value: ethers.utils.parseEther("1"),
        })).to.be.revertedWith("reach deposit count limit by user")
    })
})