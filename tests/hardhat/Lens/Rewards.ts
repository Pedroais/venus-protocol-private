import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { ethers } from "hardhat";

import { convertToUnit } from "../../../helpers/utils";
import { Comptroller, MockToken, VToken, VenusLens, VenusLens__factory } from "../../../typechain";

let comptroller: FakeContract<Comptroller>;
let vBUSD: FakeContract<VToken>;
let vWBTC: FakeContract<VToken>;
let XVS: FakeContract<MockToken>;
let account: Signer;
let venusLens: MockContract<VenusLens>;

const VENUS_ACCRUED = convertToUnit(10, 18);

type RewardsFixtire = {
  comptroller: FakeContract<Comptroller>;
  vBUSD: FakeContract<VToken>;
  vWBTC: FakeContract<VToken>;
  XVS: FakeContract<MockToken>;
  venusLens: MockContract<VenusLens>;
};

const rewardsFixture = async (): Promise<RewardsFixtire> => {
  vBUSD = await smock.fake<VToken>("VToken");
  vWBTC = await smock.fake<VToken>("VToken");
  XVS = await smock.fake<MockToken>("MockToken");
  const venusLensFactory = await smock.mock<VenusLens__factory>("VenusLens");
  venusLens = await venusLensFactory.deploy();
  comptroller = await smock.fake<Comptroller>("Comptroller");

  // Fake return values
  comptroller.getAllMarkets.returns([vBUSD.address, vWBTC.address]);
  comptroller.getXVSAddress.returns(XVS.address);
  comptroller.venusAccrued.returns(VENUS_ACCRUED);
  comptroller.venusInitialIndex.returns(convertToUnit(1, 18));
  comptroller.venusSupplySpeeds.returns(convertToUnit(0.5, 18));
  comptroller.venusBorrowSpeeds.returns(convertToUnit(0.5, 18));
  comptroller.venusSupplierIndex.returns(convertToUnit(1, 18));
  comptroller.venusBorrowerIndex.returns(convertToUnit(1, 18));

  comptroller.venusBorrowState.returns({
    index: convertToUnit(1, 18),
    block: 1,
  });

  comptroller.venusSupplyState.returns({
    index: convertToUnit(1, 18),
    block: 1,
  });

  vBUSD.borrowIndex.returns(convertToUnit(1, 18));
  vBUSD.totalBorrows.returns(convertToUnit(10000, 8));
  vBUSD.totalSupply.returns(convertToUnit(10000, 8));
  vBUSD.balanceOf.returns(convertToUnit(100, 8));
  vBUSD.borrowBalanceStored.returns(convertToUnit(100, 8));

  vWBTC.borrowIndex.returns(convertToUnit(1, 18));
  vWBTC.totalBorrows.returns(convertToUnit(100, 18));
  vWBTC.totalSupply.returns(convertToUnit(100, 18));
  vWBTC.balanceOf.returns(convertToUnit(100, 8));
  vWBTC.borrowBalanceStored.returns(convertToUnit(100, 8));

  return {
    comptroller,
    XVS,
    vBUSD,
    vWBTC,
    venusLens,
  };
};

describe("VenusLens: Rewards Summary", () => {
  beforeEach(async () => {
    [account] = await ethers.getSigners();
    ({ comptroller, vBUSD, vWBTC, XVS, venusLens } = await loadFixture(rewardsFixture));
  });
  it("Should get summary for all markets", async () => {
    // Mine some blocks so deltaBlocks != 0
    await mine(11);

    const accountAddress = await account.getAddress();
    const pendingRewards = await venusLens.pendingRewards(accountAddress, comptroller.address);

    expect(comptroller.getAllMarkets).to.have.been.calledOnce;
    expect(comptroller.getXVSAddress).to.have.been.calledOnce;
    expect(comptroller.venusAccrued).to.have.been.calledOnceWith(accountAddress);

    expect(comptroller.venusBorrowState).to.have.been.calledWith(vWBTC.address);
    expect(comptroller.venusBorrowState).to.have.been.calledWith(vBUSD.address);

    expect(comptroller.venusSupplyState).to.have.been.calledWith(vWBTC.address);
    expect(comptroller.venusSupplyState).to.have.been.calledWith(vBUSD.address);

    expect(comptroller.venusBorrowSpeeds).to.have.been.calledWith(vWBTC.address);
    expect(comptroller.venusBorrowSpeeds).to.have.been.calledWith(vBUSD.address);

    expect(vBUSD.totalBorrows).to.have.been.calledOnce;
    expect(vWBTC.totalBorrows).to.have.been.calledOnce;

    expect(comptroller.venusBorrowerIndex).to.have.been.calledWith(vWBTC.address, accountAddress);
    expect(comptroller.venusBorrowerIndex).to.have.been.calledWith(vBUSD.address, accountAddress);

    expect(vWBTC.borrowBalanceStored).to.have.been.calledWith(accountAddress);
    expect(vBUSD.borrowBalanceStored).to.have.been.calledWith(accountAddress);

    expect(comptroller.venusSupplySpeeds).to.have.been.calledWith(vWBTC.address);
    expect(comptroller.venusSupplySpeeds).to.have.been.calledWith(vBUSD.address);

    expect(vBUSD.totalSupply).to.have.been.calledOnce;
    expect(vWBTC.totalSupply).to.have.been.calledOnce;

    expect(comptroller.venusSupplierIndex).to.have.been.calledWith(vWBTC.address, accountAddress);
    expect(comptroller.venusSupplierIndex).to.have.been.calledWith(vBUSD.address, accountAddress);

    expect(vBUSD.balanceOf).to.have.been.calledWith(accountAddress);
    expect(vWBTC.balanceOf).to.have.been.calledWith(accountAddress);

    expect(vBUSD.borrowIndex).to.have.been.calledOnce;
    expect(vWBTC.borrowIndex).to.have.been.calledOnce;

    const EXPECTED_OUTPUT = [
      comptroller.address,
      XVS.address,
      BigNumber.from(convertToUnit(10, 18)),
      [
        [vBUSD.address, BigNumber.from(convertToUnit(22.36, 18))],
        [vWBTC.address, BigNumber.from(convertToUnit(0.0000002236, 18))],
      ],
    ];

    expect(pendingRewards).to.have.deep.members(EXPECTED_OUTPUT);
  });
});
