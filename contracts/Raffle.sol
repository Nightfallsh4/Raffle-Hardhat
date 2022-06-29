// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// Enter the lottery (by paying an amount)
// Pick a random winner using VRF
//  Winner to be selected every x mins -> completely automated
// Will need to use chainlink oracle for VRF and Automated execution

// Imports

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

// Errors
error Raffle__NotEnoughEthEntered();
error RAffle__ErrorInSendingWinnings();
error Raffle__NotOpen();
error Raffle__upkeepNotNeeded(
	uint256 currentBalance,
	uint256 numPLayers,
	uint256 raffleState
);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
	// Type declarations
	enum RaffleState {
		OPEN,
		CALCULATING
	}

	// State Variables
	uint256 private immutable i_entranceFee;
	address payable[] private s_players;
	VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
	bytes32 private immutable i_gasLane;
	uint64 private immutable i_subscriptionId;
	uint32 private immutable i_callbackGasLimit;
	uint16 private constant REQUEST_CONFIRMATION = 3;
	uint32 private constant NUM_WORDS = 1;

	// Lottery Variables
	address private s_recentWinner;
	RaffleState private s_raffleState;
	uint256 private s_lastTimeStamp;
	uint256 private immutable i_interval;

	// EVENTS
	event RaffleEnter(address indexed sender);
	event RequestedRaffleWinner(uint256 indexed requestId);
	event WinnerPicked(address indexed winner);

	constructor(
		address vrfCoordinatorV2,
		uint256 entranceFee,
		bytes32 gasLane,
		uint64 subcriptionId,
		uint32 callbackGasLimit,
		uint256 interval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entranceFee = entranceFee;
		i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_gasLane = gasLane;
		i_subscriptionId = subcriptionId;
		i_callbackGasLimit = callbackGasLimit;
		s_raffleState = RaffleState.OPEN;
		s_lastTimeStamp = block.timestamp;
		i_interval = interval;
	}

	function enterRaffle() public payable {
		if (msg.value < i_entranceFee) {
			revert Raffle__NotEnoughEthEntered();
		}

		if (s_raffleState != RaffleState.OPEN) {
			revert Raffle__NotOpen();
		}
		s_players.push(payable(msg.sender));
		emit RaffleEnter(msg.sender);
	}

	/**
	 * @dev This is the func the chainlink keeper nodes call to run off-chain
	 *
	 */

	function checkUpkeep(
		bytes memory /*checkData*/
	)
		public
		view
		override
		returns (
			bool upkeepNeeded,
			bytes memory /* performData */
		)
	{
		bool isOpen = (RaffleState.OPEN == s_raffleState);
		bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval); //timeinterval
		bool hasPlayers = (s_players.length > 0);
		bool hasBalance = address(this).balance > 0;
		upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
		return (upkeepNeeded, "");
	}

	function performUpkeep(
		bytes calldata /*performData*/
	) external override {
		// Request random number
		// 2 transaction process
		// Do something with random number
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Raffle__upkeepNotNeeded(
				address(this).balance,
				s_players.length,
				uint256(s_raffleState)
			);
		}
		s_raffleState = RaffleState.CALCULATING;
		uint256 requestId = i_vrfCoordinator.requestRandomWords(
			i_gasLane, //Max gas limit
			i_subscriptionId,
			REQUEST_CONFIRMATION,
			i_callbackGasLimit, // Gas limit to call fulfillRandomWords
			NUM_WORDS //Number of random numbers returned
		);
		emit RequestedRaffleWinner(requestId);
	}

	function fulfillRandomWords(
		uint256, /*requestId*/
		uint256[] memory randomWords
	) internal override {
		uint256 indexOfWinner = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[indexOfWinner];
		s_recentWinner = recentWinner;
		s_raffleState = RaffleState.OPEN;
		s_players = new address payable[](0);
		s_lastTimeStamp = block.timestamp;
		(bool success, ) = recentWinner.call{ value: address(this).balance }("");
		if (!success) {
			revert RAffle__ErrorInSendingWinnings();
		}
		emit WinnerPicked(recentWinner);
	}

	function getEntranceFee() public view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayer(uint256 index) public view returns (address) {
		return s_players[index];
	}

	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	function getRaffleState() public view returns (RaffleState) {
		return s_raffleState;
	}

	function getNumWords() public pure returns (uint256) {
		return NUM_WORDS;
	}

	function getNumberOfPLayers() public view returns (uint256) {
		return s_players.length;
	}

	function getLatestTimeStamp() public view returns (uint256) {
		return s_lastTimeStamp;
	}

	function getResquestConfirmations() public pure returns (uint16) {
		return REQUEST_CONFIRMATION;
	}

	function getInterval() public view returns (uint256) {
		return i_interval;
	}

	function getGasLane() public view returns (bytes32){
		return i_gasLane;
	}
}
