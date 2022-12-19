/*
 * server.ts
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

import * as path from "path";

import { ExtensionContext, TextDocument, WebviewPanel, workspace, WorkspaceEdit } from "vscode";
import { defaultEditorServerOptions, editorServerMethods } from "editor-server";
import { kVEHostApplyVisualEdit, VisualEditorContainer } from "vscode-types";
import { QuartoContext } from "quarto-core";
import { jsonRpcPostMessageServer, JsonRpcPostMessageTarget, JsonRpcServerMethod } from "core";

import { getWholeRange } from "../../core/doc";

// setup postMessage server on webview panel
export function editorServer(
  context: ExtensionContext, 
  quartoContext: QuartoContext,
  document: TextDocument,
  webviewPanel: WebviewPanel) 
: VoidFunction {
  
  const options = defaultEditorServerOptions(
    context.asAbsolutePath(path.join("assets", "editor", "resources")),
    quartoContext.pandocPath
  );
  
  const target: JsonRpcPostMessageTarget = {
    postMessage: (data) => {
      webviewPanel.webview.postMessage(data);
    },
    onMessage: (handler: (data: unknown) => void) => {
      const disposable = webviewPanel.webview.onDidReceiveMessage(ev => {
        handler(ev);
      });
      return () => {
        disposable.dispose();
      };
    }
  };

  return jsonRpcPostMessageServer(target, {
    ...editorServerMethods(options),
    ...editorContainerMethods(document)
  });
}



function editorContainerMethods(document: TextDocument) : Record<string,JsonRpcServerMethod> {
  const host = editorContainer(document);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kVEHostApplyVisualEdit]: args => host.applyVisualEdit(args[0])
  };
  return methods;
}

function editorContainer(document: TextDocument) : VisualEditorContainer {
  return {
    applyVisualEdit: async (text: string) => {
      const wholeDocRange = getWholeRange(document);
      const edit = new WorkspaceEdit();
      edit.replace(document.uri, wholeDocRange, text);
      await workspace.applyEdit(edit);
    }
  };
}