const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

let daemonProcess = null;
let statusBarItem = null;
let outputChannel = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Antigravity Auto-Retry extension is now active');

    outputChannel = vscode.window.createOutputChannel('Antigravity Auto-Retry');
    
    // Create a single status bar item for a seamless look
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'antigravity-auto-retry.showMenu';
    context.subscriptions.push(statusBarItem);
    
    updateStatusBar(false);
    statusBarItem.show();

    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.showMenu', showMenu));
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.start', startDaemon));
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.stop', stopDaemon));
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.test', runTest));
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.restartIDE', restartIDE));

    // Auto-start (Optional: could be a setting)
    startDaemon();
}

function updateStatusBar(running) {
    const icon = running ? '$(check)' : '$(circle-slash)';
    const statusText = running ? 'RUNNING' : 'STOPPED';
    
    statusBarItem.text = `${icon} Auto-Retry`;
    statusBarItem.tooltip = `Antigravity Auto-Retry: ${statusText}`;
    
    // Remove custom coloring to keep it seamless with the IDE theme
    statusBarItem.color = undefined; 
}

async function showMenu() {
    const items = [];
    if (!daemonProcess) {
        items.push({
            label: '$(play) Start Auto-Retry',
            description: 'Start the background daemon',
            command: 'antigravity-auto-retry.start'
        });
    } else {
        items.push({
            label: '$(stop) Stop Auto-Retry',
            description: 'Stop the background daemon',
            command: 'antigravity-auto-retry.stop'
        });
    }

    items.push({
        label: '$(beaker) Run Connection Test',
        description: 'Simulate high traffic dialog',
        command: 'antigravity-auto-retry.test'
    });

    items.push({
        label: '$(extensions) Reload Extension (Apply Updates)',
        description: 'Tải lại giao diện để cập nhật code Extension',
        action: () => vscode.commands.executeCommand('workbench.action.reloadWindow')
    });

    items.push({
        label: '$(sync) Restart Antigravity (Debug Mode)',
        description: 'Kill IDE, copy command & open Terminal',
        command: 'antigravity-auto-retry.restartIDE'
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity Auto-Retry Management'
    });

    if (selected) {
        if (selected.command) {
            vscode.commands.executeCommand(selected.command);
        } else if (selected.action) {
            selected.action();
        }
    }
}

function startDaemon() {
    if (daemonProcess) {
        vscode.window.showInformationMessage('Auto-Retry is already running.');
        return;
    }

    const scriptPath = path.join(__dirname, 'auto-retry.js');
    outputChannel.appendLine(`[Extension] Starting daemon: node ${scriptPath}`);

    daemonProcess = cp.spawn('node', [scriptPath], {
        env: { ...process.env, DEBUG: '1' }
    });

    daemonProcess.stdout.on('data', (data) => {
        outputChannel.append(data.toString());
    });

    daemonProcess.stderr.on('data', (data) => {
        outputChannel.append(`[ERROR] ${data.toString()}`);
    });

    daemonProcess.on('close', (code) => {
        outputChannel.appendLine(`[Extension] Daemon process exited with code ${code}`);
        daemonProcess = null;
        updateStatusBar(false);
    });

    updateStatusBar(true);
    vscode.window.showInformationMessage('Antigravity Auto-Retry started.');
}

function stopDaemon() {
    if (!daemonProcess) {
        vscode.window.showInformationMessage('Auto-Retry is not running.');
        return;
    }

    daemonProcess.kill();
    daemonProcess = null;
    updateStatusBar(false);
    vscode.window.showInformationMessage('Antigravity Auto-Retry stopped.');
}


function runTest() {
    const testScript = path.join(__dirname, '..', 'scripts', 'trigger-test.js');
    outputChannel.appendLine(`[Extension] Running test: node ${testScript}`);
    
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Antigravity Auto-Retry: Kiểm tra kết nối...",
        cancellable: false
    }, (progress) => {
        return new Promise((resolve) => {
            cp.exec(`node ${testScript}`, (err, stdout, stderr) => {
                outputChannel.append(stdout);
                if (stderr) outputChannel.append(`[STDERR] ${stderr}`);

                if (err) {
                    vscode.window.showErrorMessage(`❌ Test thất bại: ${err.message}`);
                } else if (stdout.includes('SUCCESS:')) {
                    vscode.window.showInformationMessage('✅ Auto-Retry Test Thành công: Đã phát hiện và click dialog!');
                } else if (stdout.includes('TIMEOUT:')) {
                    vscode.window.showWarningMessage('⚠️ Test Timeout: Không phát hiện thao tác click trong 10s.');
                } else if (stdout.includes('Failed: Script not yet injected')) {
                    vscode.window.showWarningMessage('⚠️ Test thất bại: Script chưa được inject vào trang.');
                } else {
                    vscode.window.showInformationMessage('✨ Đã gửi lệnh test đến Antigravity.');
                }
                resolve();
            });
        });
    });
}

function restartIDE() {
    const cmd = 'open -a Antigravity --args --remote-debugging-port=9222';
    vscode.env.clipboard.writeText(cmd).then(() => {
        vscode.window.showInformationMessage('Đã copy lệnh vào Clipboard. Đang đóng IDE...');
        cp.exec('open -a Terminal', () => {
            setTimeout(() => {
                cp.exec('pkill -f "Antigravity.app" || pkill -f "Antigravity"');
            }, 1500);
        });
    });
}

function deactivate() {
    if (daemonProcess) {
        daemonProcess.kill();
    }
}

module.exports = {
    activate,
    deactivate
};
