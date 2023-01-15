/*
 * index.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
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

import { Node as ProsemirrorNode } from 'prosemirror-model'
import { EditorView as PMEditorView} from "prosemirror-view";

import { Extension } from "@codemirror/state";
import { EditorView } from '@codemirror/view';

import { CodeViewOptions, ExtensionContext } from "editor";

import { langModeBehavior } from './langmode';
import { keyboardBehavior } from './keyboard';
import { findBehavior } from './find';
import { indentBehavior } from './indent';
import { bracketsBehavior } from './brackets';
import { trackSelectionBehavior } from './trackselection';
import { themeBehavior } from './theme';
import { prefsBehavior } from './prefs';

export interface Behavior {
  extensions: Extension[];
  init?: (pmNode: ProsemirrorNode, cmView: EditorView) => void;
  pmUpdate?: (prevNode: ProsemirrorNode, updateNode: ProsemirrorNode, cmView: EditorView) => void;
  cleanup?: VoidFunction;
}

export interface BehaviorContext {
  view: PMEditorView;
  getPos: boolean | (() => number);
  options: CodeViewOptions;
  pmContext: ExtensionContext;
  withState: WithState
}

export enum State { Updating, Escaping };
export type WithState = (state: State, fn: () => void) => void; 

export function createBehaviors(context: BehaviorContext) : Behavior[] {
  return [
    langModeBehavior(context),
    keyboardBehavior(context),
    findBehavior(context),
    indentBehavior(),
    bracketsBehavior(),
    themeBehavior(),
    prefsBehavior(context),
    trackSelectionBehavior(context)
  ]
}

export function behaviorExtensions(
  behaviors: Behavior[]
) : Extension[] {
  return behaviors.flatMap(behavior => behavior.extensions);
}

export function behaviorInit(
  behaviors: Behavior[],
  pmNode: ProsemirrorNode, cmView: EditorView
) {
  behaviors.forEach(behavior =>  behavior.init?.(pmNode, cmView));
}

export function behaviorPmUpdate(
  behaviors: Behavior[],
  prevNode: ProsemirrorNode, updateNode: ProsemirrorNode, cmView: EditorView
) {
  behaviors.forEach(behavior => behavior.pmUpdate?.(prevNode, updateNode, cmView));
}

export function behaviorCleanup(
  behaviors: Behavior[]
) {
  behaviors.forEach(behavior =>  behavior.cleanup?.());
}



