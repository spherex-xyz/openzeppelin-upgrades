const test = require('ava');

const { ethers, upgrades } = require('hardhat');

test.before(async t => {
  t.context.Greeter = await ethers.getContractFactory('GreeterProxiable');
  t.context.GreeterV2 = await ethers.getContractFactory('GreeterV2Proxiable');
  t.context.GreeterProtectedUpgradeable = await ethers.getContractFactory('GreeterProtectedUpgradeable');
  t.context.GreeterV2ProtectedUpgradeable = await ethers.getContractFactory('GreeterV2ProtectedUpgradeable');
});

test('happy path - call with args', async t => {
  const { Greeter, GreeterV2 } = t.context;

  const greeter = await upgrades.deployProxy(Greeter, ['Hello, Hardhat!'], { kind: 'uups' });

  t.is(await greeter.greet(), 'Hello, Hardhat!');

  await upgrades.upgradeProxy(greeter, GreeterV2, {
    call: { fn: 'setGreeting', args: ['Called during upgrade'] },
  });

  t.is(await greeter.greet(), 'Called during upgrade');
});

test('sub proxy', async t => {
  const { GreeterProtectedUpgradeable, GreeterV2ProtectedUpgradeable } = t.context;

  const greeter = await upgrades.deploySubProxy(GreeterProtectedUpgradeable, ['Hello, Hardhat!']);

  t.is(await greeter.greet(), 'Hello, Hardhat!');

  await upgrades.upgradeSubProxy(greeter, GreeterV2ProtectedUpgradeable, {
    call: { fn: 'setGreeting', args: ['Called during upgrade'] },
  });
});

test('happy path - call without args', async t => {
  const { Greeter, GreeterV2 } = t.context;

  const greeter = await upgrades.deployProxy(Greeter, ['Hello, Hardhat!'], { kind: 'uups' });

  t.is(await greeter.greet(), 'Hello, Hardhat!');

  await upgrades.upgradeProxy(greeter, GreeterV2, {
    call: 'resetGreeting',
  });

  t.is(await greeter.greet(), 'Hello World');
});
