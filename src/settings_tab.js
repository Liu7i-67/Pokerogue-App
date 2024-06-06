const utils = require("./utils");
const globals = require("./globals");

const getTabData = () => {
  return {
    label: "设置",
    submenu: [
      {
        label: "离线模式(使用单独保存，需要游戏文件)",
        type: "checkbox",
        checked: globals.isOfflineMode,
        enabled: globals.gameFilesDownloaded,
        click: () => {
          globals.isOfflineMode = !globals.isOfflineMode;
          utils.saveSettings();
          utils.resetGame();
        },
      },
      {
        label: "自动隐藏此菜单(Alt键重新打开)",
        type: "checkbox",
        checked: globals.autoHideMenu,
        click: () => {
          globals.autoHideMenu = !globals.autoHideMenu;
          globals.mainWindow.setAutoHideMenuBar(globals.autoHideMenu);
          globals.mainWindow.setMenuBarVisibility(!globals.autoHideMenu);
          utils.saveSettings();
        },
      },
      {
        label: "关闭窗口时结束游戏", // When enabled, utility windows are completely closed rather than being hidden if they are toggled or exited. This can help save memory, but resets their position every toggle and might result in slower toggles.
        type: "checkbox",
        checked: globals.closeUtilityWindows,
        click: () => {
          globals.closeUtilityWindows = !globals.closeUtilityWindows;
          utils.saveSettings();
        },
      },
      {
        label: "隐藏窗口中的鼠标",
        type: "checkbox",
        checked: globals.hideCursor,
        click: () => {
          globals.hideCursor = !globals.hideCursor;
          utils.applyCursorHide();
          utils.saveSettings();
        },
      },
      {
        label: "夜间模式", // When enabled, the grey background that normally fills the outside of the game will instead be black.
        type: "checkbox",
        checked: globals.darkMode,
        click: () => {
          globals.darkMode = !globals.darkMode;
          utils.applyDarkMode();
          utils.saveSettings();
        },
      },
    ],
  };
};

module.exports.getTabData = getTabData;
