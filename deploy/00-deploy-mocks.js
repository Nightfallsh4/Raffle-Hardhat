const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")

const BASE_FEE =ethers.utils.parseEther("0.25") //cost to pay for getting randomness
const GAS_LINK_PRICE = 1e9

module.exports = async function ({ getNamedAccounts, deployments }) {
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()
	const args = [BASE_FEE,GAS_LINK_PRICE]

	if (developmentChains.includes(network.name)) {
		log("Log network detected! Deploying mocks....")
		// Deploy mock vrfCoordinator....
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log:true,
            args:args
        })
        log("Mocks Deployed!!!")
        log("----------------------------------------")
	}
}

module.exports.tags = ["all","mocks"]