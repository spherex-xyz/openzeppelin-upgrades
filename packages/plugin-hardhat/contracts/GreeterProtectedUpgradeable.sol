pragma solidity ^0.8.0;

import {ProtectedUUPSUpgradeable} from "@spherex-xyz/contracts/src/ProtectedProxies/ProtectedUUPSUpgradeable.sol";

contract GreeterProtectedUpgradeable is ProtectedUUPSUpgradeable {
    string greeting;

    function initialize(string memory _greeting) public {
        greeting = _greeting;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }

    function _authorizeUpgrade(address newImplementation) internal override {}
}
