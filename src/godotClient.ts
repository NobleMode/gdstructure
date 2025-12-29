import * as vscode from 'vscode';
import * as net from 'net';

export class GodotClient {
    private client: net.Socket | null = null;
    private statusBarItem: vscode.StatusBarItem;
    private retryTimer: NodeJS.Timeout | null = null;
    private isConnected = false;
    private output: vscode.OutputChannel;
    private buffer: Buffer = Buffer.alloc(0);

    constructor(private context: vscode.ExtensionContext) {
        this.output = vscode.window.createOutputChannel("Godot Explorer");
        this.output.appendLine("GodotClient initialized (TCP Mode).");

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.text = "$(plug) Godot: Off";
        this.statusBarItem.command = "gdstructure.reconnect";
        this.statusBarItem.tooltip = "Click to connect to Godot Editor (Port 6005)";
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
        context.subscriptions.push(this.output);

        this.connect();
    }

    private connect() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }

        const config = vscode.workspace.getConfiguration('gdstructure');
        const port = config.get('lspPort', 6005);
        const host = '127.0.0.1';

        this.output.appendLine(`Connecting to ${host}:${port}...`);
        
        this.client = new net.Socket();
        
        this.client.connect(port as number, host, () => {
            this.output.appendLine("TCP Connection Established!");
            this.isConnected = true;
            this.statusBarItem.text = "$(plug) Godot: On";
            this.statusBarItem.tooltip = "Connected to Godot Editor (TCP)";
            if (this.retryTimer) {
                clearTimeout(this.retryTimer);
                this.retryTimer = null;
            }
            // Handshake not strictly required for TCP open, but good practice to allow server to index
            // this.sendInitialize(); 
        });

        this.client.on('data', (data) => {
            // this.output.appendLine(`Rx: ${data.toString()}`);
            // We could parse LSP responses here if needed (Content-Length parsing)
        });

        this.client.on('close', () => {
            if (this.isConnected) {
                 this.output.appendLine("Connection closed.");
            }
            this.disconnect();
        });

        this.client.on('error', (err) => {
            this.output.appendLine(`TCP Error: ${err.message}`);
            this.disconnect();
        });
    }

    private disconnect() {
        this.isConnected = false;
        this.statusBarItem.text = "$(plug) Godot: Off";
        this.statusBarItem.tooltip = "Disconnected (Click to retry)";
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        
        if (!this.retryTimer) {
             this.output.appendLine("Retry in 5s...");
             this.retryTimer = setTimeout(() => this.connect(), 5000);
        }
    }
    
    public manualReconnect() {
        this.output.appendLine("Manual Reconnect...");
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.connect();
    }

    public openFile(filePath: string) {
        if (!this.isConnected || !this.client) {
            vscode.window.showWarningMessage("Not connected to Godot Editor.");
            return;
        }

        // Use the custom 'open_file' notification that Godot Tools often uses
        const payload = {
            jsonrpc: "2.0",
            method: "open_file",
            params: [filePath]
        };
        
        this.sendLspMessage(payload);
    }
    
    private sendLspMessage(obj: any) {
        const json = JSON.stringify(obj);
        const length = Buffer.byteLength(json, 'utf8');
        const header = `Content-Length: ${length}\r\n\r\n`;
        this.client?.write(header + json);
        this.output.appendLine(`Sent: ${json}`);
    }
    
    public dispose() {
        if (this.retryTimer) { clearTimeout(this.retryTimer); }
        this.client?.destroy();
        this.statusBarItem.dispose();
    }
}
