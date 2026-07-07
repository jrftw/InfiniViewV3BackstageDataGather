/**
 * Filename: backstageTransferModal.ts
 * Purpose: Column customize modal — Select all only when needed, never force Unselect all.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 */

import { Page } from "playwright";
import { BACKSTAGE_SELECTORS } from "./backstageSelectors";
import { backstageClickRace } from "./backstagePageHelpers";
import {
  gathererLogStep,
  gathererLogStepOk,
  gathererLogStepSkip,
} from "../logging/gathererStepLogger";

const BACKSTAGE_TRANSFER_MODAL_SOURCE = "backstageTransferModal";

// MARK: - Modal Detection

const BACKSTAGE_TRANSFER_MODAL_SELECTORS = [
  "#semi-modal-body",
  "section.semi-transfer-left",
  "section.semi-transfer-right",
  ".semi-modal-body .semi-transfer",
];

export async function backstageIsTransferCustomizeModalOpen(page: Page): Promise<boolean> {
  for (const sel of BACKSTAGE_TRANSFER_MODAL_SELECTORS) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

export async function backstageTryWaitForTransferCustomizeModal(
  page: Page,
  timeoutMs: number = BACKSTAGE_SELECTORS.modalWaitTimeoutMs
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await backstageIsTransferCustomizeModalOpen(page)) {
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
      return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
}

// MARK: - Open Customize Modal (management fallback)

export async function backstageOpenCustomizeModalIfNeeded(page: Page, label: string): Promise<boolean> {
  if (await backstageIsTransferCustomizeModalOpen(page)) {
    return true;
  }

  const customizeTriggers = [
    'button:has-text("Customize")',
    'button:has-text("Customize data")',
    'button:has-text("Customize columns")',
    "div.semi-card-body button:nth-of-type(1)",
  ];

  for (const selector of customizeTriggers) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — opening customize modal`, { selector });
      await btn.click();
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
      if (await backstageTryWaitForTransferCustomizeModal(page, 15_000)) {
        return true;
      }
    }
  }

  return false;
}

// MARK: - Select All In Transfer (column fields only)

function backstageTransferSelectAllLocator(page: Page) {
  return page.locator(
    'section.semi-transfer-left button:has-text("Select all"), ' +
      'section.semi-transfer-right button:has-text("Select all"), ' +
      '.semi-transfer button:has-text("Select all"):not(:has-text("Select all ("))'
  );
}

export async function backstageTransferColumnsNeedSelectAll(page: Page): Promise<boolean> {
  const selectAllButtons = backstageTransferSelectAllLocator(page);
  const count = await selectAllButtons.count();

  for (let i = 0; i < count; i++) {
    const btn = selectAllButtons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) {
      continue;
    }
    const text = ((await btn.textContent()) || "").trim();
    if (/Select all \(\d+\)/.test(text)) {
      continue;
    }
    const disabled = await btn.isDisabled().catch(() => false);
    if (!disabled) {
      return true;
    }
  }

  return false;
}

export async function backstageTransferClickSelectAllColumns(page: Page, label: string): Promise<boolean> {
  let clicked = false;
  const selectAllButtons = backstageTransferSelectAllLocator(page);
  const count = await selectAllButtons.count();

  for (let i = 0; i < count; i++) {
    const btn = selectAllButtons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) {
      continue;
    }
    const text = ((await btn.textContent()) || "").trim();
    if (/Select all \(\d+\)/.test(text)) {
      continue;
    }
    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) {
      gathererLogStepSkip(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Select all disabled`, text);
      continue;
    }
    gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — clicking Select all columns`, { buttonText: text });
    await btn.click();
    clicked = true;
    await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
  }

  return clicked;
}

// MARK: - Confirm Modal

export async function backstageTransferConfirmIfOpen(page: Page, label: string): Promise<boolean> {
  const confirmSelectors = [
    'div.semi-modal-footer button.semi-button-primary:has-text("Confirm")',
    'div.semi-modal-footer button:has-text("Confirm")',
    'button.semi-button-primary:has-text("Confirm")',
    BACKSTAGE_SELECTORS.managementConfirmButton,
  ];

  for (const selector of confirmSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Confirm column customize modal`);
      await btn.click();
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
      return true;
    }
  }

  return false;
}

// MARK: - Unselect All Reset (performance Creator Data only)

async function backstageTransferClickUnselectAllTwice(page: Page, label: string): Promise<void> {
  const unselectButtons = page.locator(
    'section.semi-transfer-left button:has-text("Unselect all"), ' +
      'section.semi-transfer-right button:has-text("Unselect all"), ' +
      'button:has-text("Unselect all")'
  );
  const count = await unselectButtons.count();

  for (let pass = 0; pass < 2; pass++) {
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const btn = unselectButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) {
        continue;
      }
      const disabled = await btn.isDisabled().catch(() => false);
      if (disabled) {
        continue;
      }
      gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Unselect all`, { pass: pass + 1 });
      await btn.click();
      clicked = true;
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
    }
    if (!clicked) {
      gathererLogStepSkip(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Unselect all`, `pass ${pass + 1}/2 not available`);
    }
  }
}

// MARK: - Performance Creator Data Column Reset

export async function backstageEnsurePerformanceCreatorDataColumnsSelected(
  page: Page,
  label: string
): Promise<void> {
  const resetEnabled = process.env.GATHERER_PERFORMANCE_COLUMN_RESET !== "false";
  const modalOpen =
    (await backstageTryWaitForTransferCustomizeModal(page)) ||
    (await backstageOpenCustomizeModalIfNeeded(page, label));

  if (!modalOpen) {
    gathererLogStepSkip(
      BACKSTAGE_TRANSFER_MODAL_SOURCE,
      `${label} — column customize modal`,
      "not open — continuing to export"
    );
    return;
  }

  if (resetEnabled) {
    await backstageTransferClickUnselectAllTwice(page, label);
  }

  await backstageTransferClickSelectAllColumns(page, label);
  await backstageTransferConfirmIfOpen(page, label);
  gathererLogStepOk(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — performance column customize step done`);
}

// MARK: - Smart Column Ensure (Select all if needed — skip Unselect all)

export async function backstageEnsureAllExportColumnsSelected(
  page: Page,
  label: string
): Promise<void> {
  const modalOpen =
    (await backstageTryWaitForTransferCustomizeModal(page)) ||
    (await backstageOpenCustomizeModalIfNeeded(page, label));

  if (!modalOpen) {
    gathererLogStepSkip(
      BACKSTAGE_TRANSFER_MODAL_SOURCE,
      `${label} — column customize modal`,
      "not open — continuing to export"
    );
    return;
  }

  const needsSelectAll = await backstageTransferColumnsNeedSelectAll(page);

  if (needsSelectAll) {
    await backstageTransferClickSelectAllColumns(page, label);
  } else {
    gathererLogStepSkip(
      BACKSTAGE_TRANSFER_MODAL_SOURCE,
      `${label} — Select all columns`,
      "all columns already selected"
    );
  }

  await backstageTransferConfirmIfOpen(page, label);
  gathererLogStepOk(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — column customize step done`);
}

// MARK: - Bulk Creator Select All (export popup — Select all (2051))

export async function backstageClickSelectAllCreatorsIfNeeded(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);

  const creatorSelectAll = page.getByRole("button", { name: /Select all \(\d+\)/i }).first();
  if (await creatorSelectAll.isVisible().catch(() => false)) {
    const disabled = await creatorSelectAll.isDisabled().catch(() => false);
    if (!disabled) {
      gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Select all creators (bulk export modal)`);
      await creatorSelectAll.click();
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
      return;
    }
    gathererLogStepSkip(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Select all creators`, "already selected");
    return;
  }

  const fallbackSelectors = [
    'div.liveplatform-flex-item > button.semi-button-primary:has-text("Select all")',
    'div.liveplatform-flex-item button:has-text("Select all")',
  ];

  for (const selector of fallbackSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      gathererLogStep(BACKSTAGE_TRANSFER_MODAL_SOURCE, `${label} — Select all creators (fallback selector)`);
      await page.waitForTimeout(BACKSTAGE_SELECTORS.modalSettleMs);
      return;
    }
  }

  gathererLogStepSkip(
    BACKSTAGE_TRANSFER_MODAL_SOURCE,
    `${label} — Select all creators button`,
    "not visible — continuing"
  );
}

// Suggestions For Features and Additions Later:
// - Read selected count from transfer panel header text
