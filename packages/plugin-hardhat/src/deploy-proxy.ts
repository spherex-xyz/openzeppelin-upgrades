import type { Contract, ContractFactory } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  BeaconProxyUnsupportedError,
  Manifest,
  ProxyDeployment,
  RemoteDeploymentId,
  logWarning,
} from '@openzeppelin/upgrades-core';

import { enableDefender } from './defender/utils';
import {
  DeployProxyOptions,
  DeployTransaction,
  deploy,
  deployProxyImpl,
  getInitializerData,
  getProxyFactory,
  getProtectedSubProxyFactory,
  getSigner,
  getTransparentUpgradeableProxyFactory,
} from './utils';
import { getContractInstance } from './utils/contract-instance';

export interface DeployFunction {
  (ImplFactory: ContractFactory, args?: unknown[], opts?: DeployProxyOptions): Promise<Contract>;
  (ImplFactory: ContractFactory, opts?: DeployProxyOptions): Promise<Contract>;
  (ImplFactory: ContractFactory, args?: unknown[]): Promise<Contract>;
}

export function makeDeployProxy(hre: HardhatRuntimeEnvironment, defenderModule: boolean): DeployFunction {
  return async function deployProxy(
    ImplFactory: ContractFactory,
    args: unknown[] | DeployProxyOptions = [],
    opts: DeployProxyOptions = {},
  ) {
    if (!Array.isArray(args)) {
      opts = args;
      args = [];
    }

    opts = enableDefender(hre, defenderModule, opts);

    const { provider } = hre.network;
    const manifest = await Manifest.forNetwork(provider);

    const { impl, kind } = await deployProxyImpl(hre, ImplFactory, opts);

    const contractInterface = ImplFactory.interface;
    const data = getInitializerData(contractInterface, args, opts.initializer);

    if (kind === 'uups') {
      if (await manifest.getAdmin()) {
        logWarning(`A proxy admin was previously deployed on this network`, [
          `This is not natively used with the current kind of proxy ('uups').`,
          `Changes to the admin will have no effect on this new proxy.`,
        ]);
      }
    }

    const signer = getSigner(ImplFactory.runner);

    let proxyDeployment: Required<ProxyDeployment> & DeployTransaction & RemoteDeploymentId;
    switch (kind) {
      case 'beacon': {
        throw new BeaconProxyUnsupportedError();
      }

      case 'uups': {
        const ProtectedProxyFactory = await getProxyFactory(hre, signer);
        proxyDeployment = Object.assign({ kind }, await deploy(hre, opts, ProtectedProxyFactory, impl, data));
        break;
      }

      case 'transparent': {
        const adminAddress = await hre.upgrades.deployProxyAdmin(signer, opts);
        const TransparentUpgradeableProxyFactory = await getTransparentUpgradeableProxyFactory(hre, signer);
        proxyDeployment = Object.assign(
          { kind },
          await deploy(hre, opts, TransparentUpgradeableProxyFactory, impl, adminAddress, data),
        );
        break;
      }
    }

    await manifest.addProxy(proxyDeployment);

    return getContractInstance(hre, ImplFactory, opts, proxyDeployment);
  };
}

export function makeDeploySubProxy(hre: HardhatRuntimeEnvironment, defenderModule: boolean): DeployFunction {
  return async function deploySubProxy(ImplFactory: ContractFactory, args: unknown[] | DeployProxyOptions = []) {
    const signer = getSigner(ImplFactory.runner);
    const deployProxy = makeDeployProxy(hre, false);

    if (!Array.isArray(args)) {
      args = [];
    }

    let imp = await ImplFactory.deploy();
    await imp.waitForDeployment();
    console.log(`Deploy Imp done @ ${await imp.getAddress()}`);

    let MiddlewareProxy = await getProtectedSubProxyFactory(hre, signer);
    const contract_init_data = imp.interface.encodeFunctionData('initialize', args);

    let proxy = await deployProxy(
      MiddlewareProxy,
      [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        await imp.getAddress(),
        contract_init_data,
      ],
      {
        initializer: 'initialize',
        kind: 'uups',
        unsafeAllow: ['delegatecall'],
      },
    );

    await new Promise(f => setTimeout(f, 3000));
    await proxy.deployed();

    proxy = new hre.ethers.Contract(await proxy.getAddress(), ImplFactory.interface, signer);
    console.log('Deploy Treasury Middleware Proxy done @ ' + (await proxy.getSubImplementation()));
    console.log(`Deploy Proxy done @ ${proxy.address}`);
    return proxy;
  };
}
