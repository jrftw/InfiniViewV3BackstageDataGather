/**
 * Filename: backstageSelectors.ts
 * Purpose: Centralized Backstage UI selectors — edit here when Backstage UI changes.
 * Author: Kevin Doyle Jr. / Infinitum Imagery LLC
 * Last Modified: 2026-06-23
 * Platform Compatibility: Playwright (Chromium)
 *
 * Recorded against:
 * - https://live-backstage.tiktok.com/login/
 * - https://live-backstage.tiktok.com/portal/anchor/list
 * - https://live-backstage.tiktok.com/portal/data/data?anchorID
 */

// MARK: - Navigation Paths

export const BACKSTAGE_SELECTORS = {
  loginPath: "/login/",
  homeLoginButton: ".semi-button:nth-child(4) strong",
  loginEmailInput: "#email",
  loginPasswordInput: "#password",
  loginSubmitBlock: ".semi-button-block > .semi-button-content",
  loginSubmitButton: 'div.semi-portal button:has-text("Log in"), button:has-text("Log in")',
  loginGotItButton: ".semi-spin-children .semi-button-content",

  postLoginSettleMs: 2000,
  loginTypingDelayMs: 50,

  managementListPath: "/portal/anchor/list",
  performanceDataPath: "/portal/data/data",
  regionSwitchProbePath: "/portal/administration/settlement",

  headerRegionSelectionSpan: "#header div.semi-select-selection span",
  headerRegionTitle: "div.headerTitle-O0dQx5",
  regionChangeConfirmButton: 'div.semi-modal-footer button:has-text("Confirm")',

  viewportWidth: 2560,
  viewportHeight: 1271,

  navigationTimeoutMs: 90_000,
  actionTimeoutMs: 15_000,
  pageLoadWaitMs: 4000,
  modalSettleMs: 800,
  modalWaitTimeoutMs: 30_000,
  downloadTimeoutMs: 180_000,
  notificationWaitMs: 120_000,

  loggedInUrlFragment: "/portal/",
  loginUrlFragment: "/login",

  semiModalClose: 'button.semi-modal-close, button[aria-label="Close"]',
  semiModalCancel: 'button.semi-button:has-text("Cancel"), button:has-text("Close")',
  semiOverlay: ".semi-modal-wrap, .semi-portal",

  managementListTabSecond: "div.semi-tabs-bar button:nth-of-type(2)",
  managementCustomizeUnselectAll: 'section.semi-transfer-left button:has-text("Unselect all")',
  managementConfirmButton: 'button.semi-button-primary:has-text("Confirm")',
  managementExportTrigger:
    'div.semi-tabs-bar-extra > button:nth-of-type(1), #neo-layout-fmp div.semi-tabs-bar-extra > button:nth-of-type(1), button:has-text("Export")',
  managementSelectAllBulk:
    'div.liveplatform-flex-item > button.semi-button-primary:has-text("Select all"), div.liveplatform-flex-item > button.semi-button-primary > span',
  managementBulkExportButton:
    'div.liveplatform-flex-item > button.semi-button-primary:has-text("Export"), div.liveplatform-flex-item > button.semi-button-primary',

  performanceCustomizeDataButton:
    'div.semi-card-body button:nth-of-type(1), button:has-text("Customize data")',
  performanceCustomizeUnselectAll: 'section.semi-transfer-left button:has-text("Unselect all")',
  performanceConfirmButton: 'button.semi-button-primary:has-text("Confirm")',
  performanceExportTrigger:
    "button:nth-of-type(2) span.semi-button-content-right, div.semi-card-body button:nth-of-type(2)",
  performanceSelectAllBulk:
    'div.liveplatform-flex-item > button:nth-of-type(1):has-text("Select all"), div.liveplatform-flex-item button:has-text("Select all")',
  performanceBulkExportButton:
    "div.liveplatform-flex-item > button.semi-button-primary > span, div.liveplatform-flex-item button.semi-button-primary",

  notificationBellButton: "button.bell-wSXdfB, #header button:has(svg)",
  notificationViewButton: 'button:has-text("View"), div.semi-notification-notice-content button',
  noticeMenuItemFirst: "#notice-menu-item-0 > span.semi-badge, #notice-menu-item-0",
  notificationDownloadLink:
    "#backstage-notice-list-content div.footer-j6nxQJ > span, #backstage-notice-list-content span:has-text(\"Download\")",
} as const;

// Suggestions For Features and Additions Later:
// - Load selectors from config/selectors.json for hot reload
