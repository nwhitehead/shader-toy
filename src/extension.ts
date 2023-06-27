'use strict';

import * as vscode from 'vscode';
import { compareVersions } from 'compare-versions';
import { Context } from './context';
import { ShaderToyManager } from './shadertoymanager';

export function activate(extensionContext: vscode.ExtensionContext) {
    let shadertoyExtension = vscode.extensions.getExtension('stevensona.shader-toy');

    if (shadertoyExtension) {
        let lastVersion = extensionContext.globalState.get<string>('version') || '0.0.0';
        let currentVersion = <string | undefined>shadertoyExtension.packageJSON.version || '9.9.9';
        if (compareVersions(currentVersion, lastVersion) > 0) {
            vscode.window.showInformationMessage('Your ShaderToy version just got updated, check out the readme to see what\'s new.');
            extensionContext.globalState.update('version', currentVersion);
        }
    }

    let context = new Context(extensionContext, vscode.workspace.getConfiguration('shader-toy'));
    if (context.getConfig<boolean>('omitDeprecationWarnings') === true) {
        vscode.window.showWarningMessage('Deprecation warnings are omitted, stay safe otherwise!');
    }

    let shadertoyManager = new ShaderToyManager(context);

    let timeout: ReturnType<typeof setTimeout>;
    let changeTextEvent: vscode.Disposable | undefined;
    let changeEditorEvent: vscode.Disposable | undefined;
    let registerCallbacks = () => {
        clearTimeout(timeout);
        if (changeTextEvent !== undefined) {
            changeTextEvent.dispose();
        }
        if (changeEditorEvent !== undefined) {
            changeEditorEvent.dispose();
        }

        if (context.getConfig<boolean>('reloadOnEditText')) {
            let reloadDelay: number = context.getConfig<number>('reloadOnEditTextDelay') || 1.0;
            changeTextEvent = vscode.workspace.onDidChangeTextDocument((documentChange: vscode.TextDocumentChangeEvent) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    shadertoyManager.onDocumentChanged(documentChange);
                }, reloadDelay * 1000);
            });
        }

        changeEditorEvent = vscode.window.onDidChangeActiveTextEditor((newEditor: vscode.TextEditor | undefined) => {
            shadertoyManager.onEditorChanged(newEditor);
        });
    };

    registerCallbacks();

    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('shader-toy')) {
            let lastActiveEditor = context.activeEditor;
            context = new Context(extensionContext, vscode.workspace.getConfiguration('shader-toy'));
            if (context.activeEditor === undefined) {
                context.activeEditor = lastActiveEditor;
            }
            shadertoyManager.migrateToNewContext(context);
        }
    });

    let previewCommand = vscode.commands.registerCommand('shader-toy.showGlslPreview', () => {
        shadertoyManager.showDynamicPreview();
    });
    let staticPreviewCommand = vscode.commands.registerCommand('shader-toy.showStaticGlslPreview', () => {
        shadertoyManager.showStaticPreview();
    });
    let standaloneCompileCommand = vscode.commands.registerCommand('shader-toy.createPortableGlslPreview', () => {
        shadertoyManager.createPortablePreview();
    });
    let pausePreviewsCommand = vscode.commands.registerCommand('shader-toy.pauseGlslPreviews', () => {
        shadertoyManager.postCommand('pause');
    });
    let saveScreenshotsCommand = vscode.commands.registerCommand('shader-toy.saveGlslPreviewScreenShots', () => {
        shadertoyManager.postCommand('screenshot');
    });
    extensionContext.subscriptions.push(previewCommand);
    extensionContext.subscriptions.push(staticPreviewCommand);
    extensionContext.subscriptions.push(standaloneCompileCommand);
    extensionContext.subscriptions.push(pausePreviewsCommand);
    extensionContext.subscriptions.push(saveScreenshotsCommand);
}

export function deactivate() {
}
