/*
 * images.ts
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


import * as fs from "fs";
import path from "path";

import { nanoid } from "nanoid";

import { TextDocument } from "vscode";

import { EditorUIImageResolver } from "editor-types";
import { isHttpUrl } from "core";


export function documentImageResolver(
  doc: TextDocument, 
  projectDir?: string
) : EditorUIImageResolver {
  
  const docDir = path.normalize(path.dirname(doc.fileName));
  projectDir = projectDir ? path.normalize(projectDir) : undefined;

  const ensureForwardSlashes = (path: string) => {
    return path.replace(/\\/, "/");
  };

  const ensureImagesDir = () => {
    const imagesDir = path.join(docDir, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
    }
    return imagesDir;
  };

  const uniqueImagePath = (stem: string, ext: string, preserveStem?: boolean) => {

    // try for a short name w/ integer, fallback to a longer one
    ext = ext || ".png";
    const imagesDir = ensureImagesDir();
    for (let i=0; i<100; i++) {
      const imagePath = path.join(imagesDir, `${stem}${(i > 0 || !preserveStem) ? ('-' + (i + 1)) : ''}${ext}`);
      if (!fs.existsSync(imagePath)) {
        return imagePath;
      }
    }
    return path.join(docDir, `${stem}-${nanoid()}`);
  };

  return {
    resolveImageUris: async (uris: string[]) : Promise<string[]> => {
      return uris.map(uri => {
        if (isHttpUrl(uri)) {
          return uri;
        } else {
          uri = path.normalize(uri);
          // doc dir relative
          if (uri.startsWith(docDir)) {
            return path.relative(docDir, uri);
          // project dir relative (start w/ slash)
          } else if (projectDir && uri.startsWith(projectDir)) {
            return `/${path.relative(projectDir, uri)}`;
          // otherwise copy to images dir
          } else {
            const parsedPath = path.parse(uri);
            const imagePath = uniqueImagePath(parsedPath.name, parsedPath.ext, true);
            fs.copyFileSync(uri, imagePath);
            return path.relative(docDir, imagePath);
          }
        }
      }).map(ensureForwardSlashes);
    },
    resolveBase64Images: async (base64Images: string[]) : Promise<string[]> => {
      return base64Images.map(base64 => {
        const kImgRegex = /^data:image\/(\w+);base64,/;
        const match = base64.match(kImgRegex);
        if (match) {
          const base64Data = base64.replace(kImgRegex, "");
          const imageBuffer = Buffer.from(base64Data, "base64");
          const imagePath = uniqueImagePath("paste", `.${match[1]}`);
          fs.writeFileSync(imagePath, imageBuffer);
          return ensureForwardSlashes(path.relative(docDir, imagePath));
        } else {
          return null;
        }
       ;
      }).filter(image => image !== null) as string[];
    }
  };
}


