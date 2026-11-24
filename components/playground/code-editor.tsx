"use client";

import { useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { lintGutter, linter } from "@codemirror/lint";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { Compartment, Prec } from "@codemirror/state";
import { HighlightStyle, codeFolding, foldGutter, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { cn } from "@/lib/utils";

export interface CodeEditorDiagnostics {
  errorCount: number;
  firstError?: string;
}

export interface CodeEditorProps {
  value: string;
  onChange?: (val: string) => void;
  mode: "json" | "text";
  readOnly?: boolean;
  placeholder?: string;
  onDiagnosticsChange?: (info: CodeEditorDiagnostics) => void;
  onRunShortcut?: () => void;
  className?: string;
}

const jevLightHighlightStyle = HighlightStyle.define([
  { tag: [tags.propertyName, tags.attributeName], color: "#0550ae" },
  { tag: tags.string, color: "#991b1b" },
  { tag: [tags.number, tags.integer, tags.float], color: "#0f766e" },
  { tag: tags.bool, color: "#6d28d9", fontWeight: "500" },
  { tag: tags.null, color: "#6d28d9", fontStyle: "italic" },
  { tag: [tags.brace, tags.squareBracket, tags.punctuation, tags.separator], color: "#71717a" },
  { tag: tags.invalid, color: "#dc2626", textDecoration: "underline wavy #dc2626" },
]);

const jevLightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#ffffff",
      color: "#18181b",
    },
    ".cm-content": {
      caretColor: "#18181b",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#18181b",
    },
    ".cm-matchingBracket": {
      backgroundColor: "#f4f4f5",
      outline: "1px solid #d4d4d8",
      borderRadius: "2px",
    },
  },
  { dark: false },
);

function createFoldMarker(open: boolean): HTMLElement {
  const span = document.createElement("span");
  span.className = "inline-flex items-center justify-center";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = open
    ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
    : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  return span;
}

export function validateJsonValue(value: string): CodeEditorDiagnostics {
  try {
    JSON.parse(value);
    return { errorCount: 0, firstError: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { errorCount: 1, firstError: message };
  }
}

export function CodeEditor({
  value,
  onChange,
  mode,
  readOnly = false,
  placeholder,
  onDiagnosticsChange,
  onRunShortcut,
  className,
}: CodeEditorProps) {
  const editorViewRef = useRef<EditorView | null>(null);
  const shortcutCompartment = useMemo(() => new Compartment(), []);

  useEffect(() => {
    if (mode !== "json") {
      onDiagnosticsChange?.({ errorCount: 0, firstError: undefined });
      return;
    }
    onDiagnosticsChange?.(validateJsonValue(value));
  }, [mode, value, onDiagnosticsChange]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: shortcutCompartment.reconfigure(
        Prec.highest(
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                onRunShortcut?.();
                return true;
              },
            },
          ]),
        ),
      ),
    });
  }, [onRunShortcut, shortcutCompartment]);

  const extensions = useMemo(() => {
    const exts = [
      EditorView.lineWrapping,
      syntaxHighlighting(jevLightHighlightStyle),
      codeFolding(),
      foldGutter({
        markerDOM: createFoldMarker,
      }),
      shortcutCompartment.of([]),
    ];

    if (placeholder) {
      exts.push(cmPlaceholder(placeholder));
    }

    if (mode === "json") {
      exts.push(json());
      if (!readOnly) {
        exts.push(lintGutter(), linter(jsonParseLinter(), { delay: 150 }));
      }
    }

    return exts;
  }, [mode, placeholder, readOnly, shortcutCompartment]);

  const basicSetup = useMemo(
    () => ({
      lineNumbers: true,
      highlightActiveLineGutter: !readOnly,
      highlightActiveLine: !readOnly,
      foldGutter: false,
      dropCursor: !readOnly,
      allowMultipleSelections: true,
      indentOnInput: !readOnly,
      bracketMatching: true,
      closeBrackets: !readOnly && mode === "json",
      autocompletion: false,
      rectangularSelection: true,
      crosshairCursor: false,
      highlightSelectionMatches: false,
      foldKeymap: true,
      searchKeymap: true,
      lintKeymap: false,
    }),
    [mode, readOnly],
  );

  return (
    <div
      className={cn(
        "laya-cm-editor relative h-full w-full overflow-hidden bg-background",
        readOnly && "laya-cm-readonly",
        className,
      )}
    >
      <CodeMirror
        value={value}
        height="100%"
        theme={jevLightTheme}
        editable={!readOnly}
        readOnly={readOnly}
        basicSetup={basicSetup}
        extensions={extensions}
        onCreateEditor={(view) => {
          editorViewRef.current = view;
          view.dispatch({
            effects: shortcutCompartment.reconfigure(
              Prec.highest(
                keymap.of([
                  {
                    key: "Mod-Enter",
                    run: () => {
                      onRunShortcut?.();
                      return true;
                    },
                  },
                ]),
              ),
            ),
          });
        }}
        onChange={readOnly ? undefined : (val) => onChange?.(val)}
        style={{ height: "100%" }}
      />
    </div>
  );
}
