/*
 * editor.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { 
  window,
  workspace, 
  ExtensionContext, 
  Disposable, 
  CustomTextEditorProvider, 
  TextDocument, 
  WebviewPanel, 
  CancellationToken, 
  Uri, 
  Webview
} from "vscode";

import { QuartoContext } from "quarto-core";

import { VisualEditorHost } from "vscode-types";

import { getNonce } from "../../core/nonce";

import { visualEditorClient, visualEditorServer } from "./connection";
import { editorSyncManager } from "./sync";

export function activateEditor(
  context: ExtensionContext,
  quartoContext: QuartoContext
) {
  context.subscriptions.push(VisualEditorProvider.register(context, quartoContext));
}

class VisualEditorProvider implements CustomTextEditorProvider {
  public static register(context: ExtensionContext, quartoContext: QuartoContext): Disposable {
    const provider = new VisualEditorProvider(context, quartoContext);
    const providerRegistration = window.registerCustomEditorProvider(
      VisualEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        }
      }
    );
    return providerRegistration;
  }

  private static readonly viewType = "quarto.visualEditor";

  constructor(private readonly context: ExtensionContext,
              private readonly quartoContext: QuartoContext) {}

 
  public async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken
  ): Promise<void> {

    // track disposables
    const disposables: Disposable[] = [];

    // get visual editor client
    const client = visualEditorClient(webviewPanel);
    disposables.push(client);

    // sync manager
    const syncManager = editorSyncManager(document, client.editor);

    // editor container implementation   
    const host: VisualEditorHost = {

      // editor is fully loaded and ready for communication
      editorReady: async () => {

        // initialize sync manager
        await syncManager.init();

        // notify for document changes
        disposables.push(workspace.onDidChangeTextDocument(
          async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              await syncManager.onDocumentChanged();
            }
          }
        ));

        // notify for saves (ensure we get latest changes applied)
        disposables.push(workspace.onWillSaveTextDocument(
          (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
              e.waitUntil(syncManager.onDocumentSaving());
            }
          }
        ));
      },

      // notify sync manager when visual editor is updated
      editorUpdated: syncManager.onVisualEditorChanged,
    };

    // setup server on webview iframe
    disposables.push(visualEditorServer(
      this.context, 
      this.quartoContext,
      webviewPanel,
      host
    ));

    // load editor webview
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // handle disposables when editor is closed
    webviewPanel.onDidDispose(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
   
  }

  private editorAssetUri(webview: Webview, file: string) {
    return webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "assets", "www", "editor", file));
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: Webview): string {
   
    const scriptUri = this.editorAssetUri(webview, "index.js");
    const stylesUri = this.editorAssetUri(webview, "style.css");

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">

            <!--
            Use a content security policy to only allow loading images from https or from our extension directory,
            and only allow scripts that have a specific nonce.
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            -->

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <link href="${stylesUri}" rel="stylesheet" />
            
            <title>Visual Editor</title>
        </head>
        <body>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}
