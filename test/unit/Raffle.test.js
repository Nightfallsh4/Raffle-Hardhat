const { assert, expect } = require("chai")
const { parseEther } = require("ethers/lib/utils")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
	developmentChains,
	networkConfig,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle Unit tests", function () {
			let raffle, vrfCoordinatorV2Mock, deployer, interval
			const chainId = network.config.chainId

			beforeEach(async function () {
				deployer = (await getNamedAccounts()).deployer
				await deployments.fixture(["all"])
				raffle = await ethers.getContract("Raffle", deployer)
				vrfCoordinatorV2Mock = await ethers.getContract(
					"VRFCoordinatorV2Mock",
					deployer,
				)
				interval = await raffle.getInterval()
			})

			describe("constructor", function () {
				it("Initializes the raffle correctly", async function () {
					// Ideally we want the only one assert per 'it'
					const raffleState = await raffle.getRaffleState()
					assert.equal(raffleState.toString(), "0")
					assert.equal(interval.toString(), networkConfig[chainId]["interval"])
					const entranceFee = await raffle.getEntranceFee()
					assert.equal(
						entranceFee.toString(),
						networkConfig[chainId]["entranceFee"],
					)
				})
			})

			describe("Enter raffle correctly", function () {
				it("Reverts if send amount less than entrance fee", async function () {
					await expect(
						raffle.enterRaffle({ value: ethers.utils.parseEther("0.0005") }),
					).to.be.revertedWith("Raffle__NotEnoughEthEntered")
				})

				it("Records players when they enter", async function () {
					await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					const playerFromContract = await raffle.getPlayer(0)
					assert.equal(playerFromContract, deployer)
				})

				it("Emits event on enter", async function () {
					await expect(
						raffle.enterRaffle({
							value: networkConfig[chainId]["entranceFee"],
						}),
					).to.emit(raffle, "RaffleEnter")
				})

				it("Reverts if RaffleState is calculating", async function () {
					await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
					await raffle.performUpkeep([])
					await expect(
						raffle.enterRaffle({
							value: networkConfig[chainId]["entranceFee"],
						}),
					).to.be.revertedWith("Raffle__NotOpen")
				})
			})

			describe("Check upkeep now", function () {
				it("Returns false if people havent entered yet", async function () {
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
					// await raffle.send(networkConfig[chainId]["entranceFee"])
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
					assert.equal(upkeepNeeded, false)
				})

				it("Returns false if isnt open", async function () {
					await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
					await raffle.performUpkeep([])
					const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
					assert.equal(upkeepNeeded, false)
				})

                it("Returns false if enough time hasn't passed", async function () {
                    await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() - 1,
					])
					await network.provider.send("evm_mine", [])
                    const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                    assert.equal(upkeepNeeded, false)
                })

                it("Returns true if enough time, player and raffle open", async function () {
                    await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
                    const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                    assert.equal(upkeepNeeded, true)
                })
			})

            describe("performUpkeep", function () {
                it("Reverts if upkeepNeeded is false", async function () {
                    await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__upkeepNotNeeded")
                })

                it("Changes raffleState to changing after performUpkeep", async function () {
                    await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
                    await raffle.performUpkeep([])
                    const raffleState = raffle.getRaffleState()
                    assert(raffleState.toString(),"1")
                })

                it("Emits event after performUpkeep", async function () {
                    await raffle.enterRaffle({
						value: networkConfig[chainId]["entranceFee"],
					})
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					])
					await network.provider.send("evm_mine", [])
                    await expect(raffle.performUpkeep([])).to.emit(raffle, "RequestedRaffleWinner")
                })
            })
	  })
