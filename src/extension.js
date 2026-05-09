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
    
    // Create status bar item
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

    // Auto-start (Optional: could be a setting)
    startDaemon();
}

function updateStatusBar(running) {
    if (running) {
        statusBarItem.text = `$(sync~spin) Auto-Retry: ON`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        statusBarItem.tooltip = 'Antigravity Auto-Retry is RUNNING. Click to manage.';
    } else {
        statusBarItem.text = `$(circle-slash) Auto-Retry: OFF`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'Antigravity Auto-Retry is STOPPED. Click to start.';
    }
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
        label: '$(terminal) View Logs',
        description: 'Show output channel',
        action: () => outputChannel.show()
    });

    items.push({
        label: '$(beaker) Run Connection Test',
        description: 'Simulate high traffic dialog',
        command: 'antigravity-auto-retry.test'
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
    
    cp.exec(`node ${testScript}`, (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage(`Test failed: ${err.message}`);
            return;
        }
        outputChannel.append(stdout);
        if (stderr) outputChannel.append(`[STDERR] ${stderr}`);
        vscode.window.showInformationMessage('Test trigger sent to Antigravity.');
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
