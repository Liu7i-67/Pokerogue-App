const globals = require("./globals");
const { app } = require("electron");
const AdmZip = require("adm-zip");
const ProgressBar = require("electron-progressbar");
const path = require("path");
const fs = require("fs");
const utils = require("./utils");

const getTabData = () => {
  return {
    label: "文件",
    submenu: [
      {
        label: "全屏",
        accelerator: "F11",
        click: handleClick_ToggleFullscreen,
      },
      {
        label: "显示控制台",
        accelerator: "F12",
        click: handleClick_ToggleConsole,
      },
      {
        label: "刷新",
        accelerator: "CommandOrControl+R",
        click: handleClick_Reload,
      },
      {
        label: "隐形刷新",
        accelerator: "F5",
        click: handleClick_Reload,
        visible: false,
        acceleratorWorksWhenHidden: true,
      },
      {
        label: "强制刷新",
        accelerator: "CommandOrControl+F5",
        click: handleClick_ReloadAndClear,
      },
      { type: "separator" },
      {
        label: "下载Up分享的最新游戏文件(离线)",
        click: handleClick_Download_Up_Latest,
      },
      {
        label: "下载最新游戏文件(离线)",
        click: handleClick_DownloadLatest,
      },
      {
        label: "下载Futaba的构建",
        click: handleClick_DownloadLatestFutaba,
      },
      { type: "separator" },
      {
        label: "退出",
        click: handleClick_Quit,
      },
    ],
  };
};

function handleClick_ToggleFullscreen() {
  globals.mainWindow.setFullScreen(!globals.mainWindow.isFullScreen());
}

function handleClick_ToggleConsole() {
  globals.mainWindow.webContents.toggleDevTools();
}

function handleClick_Reload() {
  utils.resetGame();
}

function handleClick_ReloadAndClear() {
  clearCache();
}

async function handleClick_Download_Up_Latest() {
  try {
    await downloadLatestUpGameFiles(globals.mainWindow);
    utils.saveSettings();
  } catch (error) {
    console.error("游戏文件下载失败:", error);
  }
}

async function handleClick_DownloadLatest() {
  try {
    await downloadLatestGameFiles(globals.mainWindow, false);
    utils.saveSettings();
  } catch (error) {
    console.error("Failed to download the latest game files:", error);
  }
}

async function handleClick_DownloadLatestFutaba() {
  try {
    await downloadLatestGameFiles(globals.mainWindow, true);
    utils.saveSettings();
  } catch (error) {
    console.error("Failed to download the latest futaba files:", error);
  }
}

function handleClick_Quit() {
  globals.mainWindow.close();
}

// Implementations

function clearCache() {
  // Set a flag to indicate that the cache should be cleared on the next launch
  app.commandLine.appendSwitch("clear-cache");

  // Relaunch the app
  app.relaunch({
    args: process.argv.slice(1).concat(["--clear-cache"]),
  });

  // Quit the current instance
  app.quit();
}

let progressBar;
let downloadOngoing = false;

function downloadLatestGameFiles(parentWindow, modded) {
  return new Promise((resolve, reject) => {
    utils
      .fetchLatestGameVersionInfo()
      .then((releaseData) => {
        let zipAsset;
        if (modded) {
          zipAsset = releaseData.assets.find(
            (asset) => asset.name === "game_futaba_mod.zip"
          );
        } else {
          zipAsset = releaseData.assets.find(
            (asset) => asset.name === "game.zip"
          );
        }

        if (zipAsset) {
          const zipUrl = zipAsset.browser_download_url;
          const zipPath = path.join(app.getPath("temp"), "game.zip");

          opts = {
            indeterminate: false,
            text: "Downloading game files...",
            detail: "Preparing to download...",
            maxValue: 100,
            closeOnComplete: true,
            modal: true,
            alwaysOnTop: true,
          };

          if (parentWindow) opts.parent = parentWindow;

          progressBar = new ProgressBar(opts);

          const totalBytes = zipAsset.size;
          function onBytesReceived(receivedBytes) {
            if (!progressBar) return;
            const percentage = Math.floor((receivedBytes / totalBytes) * 100);
            progressBar.value = percentage;
            progressBar.detail = `${receivedBytes} bytes received...`;
          }
          if (!downloadOngoing) {
            downloadOngoing = true;
            utils
              .downloadFile(zipUrl, zipPath, onBytesReceived)
              .then((_) => {
                progressBar.detail = `Deleting old files...`;

                const zip = new AdmZip(zipPath);

                // Delete the old game files
                fs.rmSync(globals.gameDir, {
                  recursive: true,
                  force: true,
                });

                progressBar.detail = `Extracting... (This may take a while)`;

                zip.extractAllTo(globals.gameDir, true);

                fs.unlinkSync(zipPath);

                fs.writeFile(
                  globals.currentVersionPath,
                  releaseData.tag_name,
                  "utf8",
                  (err) => {
                    if (err)
                      console.error(
                        "Failed to write Current Version with error %O",
                        err
                      );
                  }
                );
                globals.gameFilesDownloaded = true;
                utils.updateMenu();
                if (globals.isOfflineMode) {
                  utils.resetGame();
                }
                resolve();
              })
              .catch((error) => {
                reject(error);
              })
              .finally(() => (downloadOngoing = false));
          }
        } else {
          console.error("game.zip asset not found in the latest release");
          reject(new Error("game.zip asset not found in the latest release."));
        }
      })
      .catch((reason) => {
        reject(reason);
      });
  });
}

function downloadLatestUpGameFiles(parentWindow) {
  return new Promise((resolve, reject) => {
    utils
      .fetchUpLatestGameVersionInfo()
      .then(async (releaseData) => {
        const name = releaseData.name || "";

        const zipAssets = releaseData.assets.filter(
          (i) => i.name.includes(".zip") && i.name.includes("game_")
        );

        // 删除老的文件
        fs.rmSync(globals.gameDir, {
          recursive: true,
          force: true,
        });

        if (zipAssets.length) {
          opts = {
            indeterminate: false,
            text: `[${name}]正在下载第0/${zipAssets.length}个文件`,
            detail: "等待下载...",
            maxValue: zipAssets.length,
            closeOnComplete: false,
            modal: true,
            alwaysOnTop: true,
            parent: parentWindow,
          };

          progressBar = new ProgressBar(opts);

          for (let i = 0; i < zipAssets.length; i++) {
            const zipAsset = zipAssets[i];
            const zipUrl = zipAsset.browser_download_url;
            const zipPath = path.join(app.getPath("temp"), `game_${i}.zip`);

            progressBar.text = `[${name}]正在下载第${i + 1}/${
              zipAssets.length
            }个文件`;
            progressBar.detail = "文件下载中...";
            progressBar.value = i;
            try {
              await utils.downloadUpFile(zipUrl, zipPath);

              const zip = new AdmZip(zipPath);
              progressBar.detail = `文件提取中……(请耐心等待)`;
              zip.extractAllTo(globals.gameDir, true);
            } catch (e) {
              progressBar.close();
              reject(error);
            }

            function onBytesReceived(receivedBytes) {
              if (!progressBar) return;
              progressBar.detail = `接收到${receivedBytes} 字节...`;
            }

            if (!downloadOngoing) {
              downloadOngoing = true;
              await utils
                .downloadUpFile(zipUrl, zipPath, onBytesReceived)
                .then((_) => {
                  const zip = new AdmZip(zipPath);

                  progressBar.detail = `文件提取中……(请耐心等待)`;

                  zip.extractAllTo(globals.gameDir, true);

                  fs.unlinkSync(zipPath);
                  resolve();
                })
                .catch((error) => {
                  reject(error);
                })
                .finally(() => (downloadOngoing = false));
            }
          }

          progressBar.close();
          // 现在我们已经保存了文件，我们写入当前的标签版本以供参考
          fs.writeFile(globals.currentVersionPath, name, "utf8", (err) => {
            if (err)
              console.error(
                "Failed to write Current Version with error %O",
                err
              );
          });
          globals.gameFilesDownloaded = true;
          utils.updateMenu();
          if (globals.isOfflineMode) {
            utils.resetGame();
          }

          resolve();
        }
      })
      .catch((reason) => {
        reject(reason);
      });
  });
}

module.exports.getTabData = getTabData;
module.exports.downloadLatestGameFiles = downloadLatestGameFiles;
