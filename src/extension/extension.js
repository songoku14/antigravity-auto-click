const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

let daemonProcess = null;
let statusBarItem = null;
let outputChannel = null;

function isAutoAcceptEnabled(config) {
    const autoAccept = config && config.autoAccept;
    return autoAccept === true || (!!autoAccept && typeof autoAccept === 'object' && autoAccept.enabled !== false);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Antigravity Auto-Click extension is now active');

    outputChannel = vscode.window.createOutputChannel('Antigravity Auto-Click');

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
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.restartIDE', restartIDE));
    context.subscriptions.push(vscode.commands.registerCommand('antigravity-auto-retry.editConfig', editConfig));

    // Auto-start (Optional: could be a setting)
    startDaemon();
}

function updateStatusBar(running) {
    const icon = running ? '$(check)' : '$(circle-slash)';
    const statusText = running ? 'RUNNING' : 'STOPPED';

    let activeFeatures = [];
    try {
        const config = readConfig();
        if (config.autoRetry !== false) activeFeatures.push('R');
        
        const autoAccept = config.autoAccept;
        if (autoAccept === true) {
            activeFeatures.push('A');
        } else if (isAutoAcceptEnabled(config)) {
            let activeCats = [];
            const cats = autoAccept.categories || {};
            if (cats.terminal && cats.terminal.enabled !== false) activeCats.push('t');
            if (cats.review && cats.review.enabled !== false) activeCats.push('r');
            if (cats.system && cats.system.enabled !== false) activeCats.push('s');
            
            if (activeCats.length > 0) {
                activeFeatures.push(`A[${activeCats.join('')}]`);
            } else {
                activeFeatures.push('A');
            }
        }
    } catch (e) { }

    const featuresText = activeFeatures.length > 0 ? ` (${activeFeatures.join('/')})` : ' (OFF)';
    statusBarItem.text = `${icon} Auto-Click${running ? featuresText : ''}`;
    statusBarItem.tooltip = `Antigravity Auto-Click: ${statusText}${running ? featuresText : ''}`;
    statusBarItem.color = undefined;
}

function readConfig() {
    const configPath = path.join(__dirname, '..', '..', 'config.json');
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return { autoRetry: false, autoAccept: false };
}

function writeConfig(config) {
    const configPath = path.join(__dirname, '..', '..', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function showMenu() {
    const config = readConfig();
    const items = [];

    // --- Auto-Retry ---
    items.push({ label: '--- Auto-Retry ---', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: `${config.autoRetry !== false ? '$(check)' : '$(circle-slash)'} Enable Auto-Retry`,
        description: config.autoRetry !== false ? 'Currently Enabled' : 'Currently Disabled',
        action: () => toggleFeature('autoRetry')
    });


    // --- Auto-Accept ---
    items.push({ label: '--- Auto-Accept ---', kind: vscode.QuickPickItemKind.Separator });
    
    const autoAcceptEnabled = isAutoAcceptEnabled(config);
    
    items.push({
        label: `${autoAcceptEnabled ? '$(check)' : '$(circle-slash)'} Enable Auto-Accept (Master)`,
        description: autoAcceptEnabled ? 'Currently Enabled' : 'Currently Disabled',
        action: () => toggleFeature('autoAccept')
    });

    if (autoAcceptEnabled && typeof config.autoAccept === 'object') {
        const cats = config.autoAccept.categories || {};
        
        items.push({
            label: `   ${(cats.terminal && cats.terminal.enabled !== false) ? '$(check)' : '$(circle-slash)'} Terminal Commands`,
            description: (cats.terminal && cats.terminal.enabled !== false) ? 'Auto-runs safe terminal commands' : 'Disabled',
            action: () => toggleCategory('terminal')
        });

        items.push({
            label: `   ${(cats.review && cats.review.enabled !== false) ? '$(check)' : '$(circle-slash)'} Review / Agent Prompts`,
            description: (cats.review && cats.review.enabled !== false) ? 'Auto-accepts review requests' : 'Disabled',
            action: () => toggleCategory('review')
        });

        items.push({
            label: `   ${(cats.system && cats.system.enabled !== false) ? '$(check)' : '$(circle-slash)'} System / Security`,
            description: (cats.system && cats.system.enabled !== false) ? 'Auto-accepts security dialogs' : 'Disabled',
            action: () => toggleCategory('system')
        });
    }


    // --- System ---
    items.push({ label: '--- System ---', kind: vscode.QuickPickItemKind.Separator });
    if (!daemonProcess) {
        items.push({
            label: '$(play) Start All Features',
            description: 'Start background automation process',
            command: 'antigravity-auto-retry.start'
        });
    } else {
        items.push({
            label: '$(stop) Stop All Features',
            description: 'Stop background automation process',
            command: 'antigravity-auto-retry.stop'
        });
    }

    items.push({
        label: '$(settings-gear) Edit Blacklist / Settings',
        description: 'Cấu hình các lệnh terminal bị chặn',
        command: 'antigravity-auto-retry.editConfig'
    });

    items.push({
        label: '$(sync) Restart Antigravity (Debug Mode)',
        description: 'Kill IDE, copy command & open Terminal',
        command: 'antigravity-auto-retry.restartIDE'
    });

    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

    items.push({
        label: '$(extensions) Reload Extension',
        action: () => vscode.commands.executeCommand('workbench.action.reloadWindow')
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity Auto-Click Management'
    });

    if (selected) {
        if (selected.command) {
            vscode.commands.executeCommand(selected.command);
        } else if (selected.action) {
            selected.action();
        }
    }
}

function toggleFeature(feature) {
    const config = readConfig();
    if (feature === 'autoAccept' && typeof config.autoAccept === 'object') {
        config.autoAccept.enabled = config.autoAccept.enabled === false ? true : false;
    } else {
        config[feature] = config[feature] === false ? true : false;
    }
    writeConfig(config);
    
    let label = feature;
    let isEnabled = false;
    if (feature === 'autoAccept' && typeof config.autoAccept === 'object') {
        label = 'Auto-Accept';
        isEnabled = config.autoAccept.enabled;
    } else {
        label = feature === 'autoRetry' ? 'Auto-Retry' : 'Auto-Accept';
        isEnabled = config[feature];
    }

    vscode.window.showInformationMessage(`${label} is now ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
    updateStatusBar(!!daemonProcess);
}

function toggleCategory(category) {
    const config = readConfig();
    if (!config.autoAccept || typeof config.autoAccept !== 'object') {
        config.autoAccept = { enabled: false, categories: {} };
    }
    if (!config.autoAccept.categories) {
        config.autoAccept.categories = {};
    }
    if (!config.autoAccept.categories[category]) {
        config.autoAccept.categories[category] = { enabled: false, patterns: [] };
    }
    
    config.autoAccept.categories[category].enabled = config.autoAccept.categories[category].enabled === false ? true : false;
    writeConfig(config);
    
    vscode.window.showInformationMessage(`Auto-Accept [${category.toUpperCase()}] is now ${config.autoAccept.categories[category].enabled ? 'ENABLED' : 'DISABLED'}`);
    updateStatusBar(!!daemonProcess);
}

function startDaemon() {
    if (daemonProcess) {
        vscode.window.showInformationMessage('Antigravity Auto-Click is already running.');
        return;
    }

    const scriptPath = path.join(__dirname, '..', 'core', 'auto-retry.js');
    outputChannel.appendLine(`[Extension] Starting: node ${scriptPath}`);

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
        outputChannel.appendLine(`[Extension] Process exited with code ${code}`);
        daemonProcess = null;
        updateStatusBar(false);
    });

    updateStatusBar(true);
    vscode.window.showInformationMessage('Antigravity Auto-Click started.');
}

function stopDaemon() {
    const stopScript = path.join(__dirname, '..', '..', 'scripts', 'core', 'stop.sh');
    cp.execFile('bash', [stopScript], (error, stdout, stderr) => {
        if (stdout) outputChannel.append(stdout);
        if (stderr) outputChannel.append(`[ERROR] ${stderr}`);
        if (error) outputChannel.appendLine(`[Extension] Stop warning: ${error.message}`);

        if (daemonProcess) daemonProcess.kill();
        daemonProcess = null;
        updateStatusBar(false);
        vscode.window.showInformationMessage('Antigravity Auto-Click stopped.');
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

async function editConfig() {
    const configPath = path.join(__dirname, '..', '..', 'config.json');
    const uri = vscode.Uri.file(configPath);
    try {
        await vscode.window.showTextDocument(uri);
    } catch (e) {
        vscode.window.showErrorMessage(`Không thể mở file cấu hình: ${e.message}`);
    }
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
