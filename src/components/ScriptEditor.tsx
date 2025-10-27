"use client";

import React, { useState, useRef, useEffect } from "react";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPaste?: (event: React.ClipboardEvent, setValue: (value: string) => void, currentValue: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// Bitcoin Script opcodes with their categories
const OPCODES = {
  // Constants
  constants: ["OP_0", "OP_FALSE", "OP_PUSHDATA1", "OP_PUSHDATA2", "OP_PUSHDATA4", "OP_1NEGATE", "OP_1", "OP_TRUE", "OP_2", "OP_3", "OP_4", "OP_5", "OP_6", "OP_7", "OP_8", "OP_9", "OP_10", "OP_11", "OP_12", "OP_13", "OP_14", "OP_15", "OP_16"],

  // Flow control
  flow: ["OP_NOP", "OP_IF", "OP_NOTIF", "OP_ELSE", "OP_ENDIF", "OP_VERIFY", "OP_RETURN"],

  // Stack operations
  stack: ["OP_TOALTSTACK", "OP_FROMALTSTACK", "OP_IFDUP", "OP_DEPTH", "OP_DROP", "OP_DUP", "OP_NIP", "OP_OVER", "OP_PICK", "OP_ROLL", "OP_ROT", "OP_SWAP", "OP_TUCK", "OP_2DROP", "OP_2DUP", "OP_3DUP", "OP_2OVER", "OP_2ROT", "OP_2SWAP"],

  // Splice operations
  splice: ["OP_CAT", "OP_SUBSTR", "OP_LEFT", "OP_RIGHT", "OP_SIZE"],

  // Bitwise logic
  bitwise: ["OP_INVERT", "OP_AND", "OP_OR", "OP_XOR", "OP_EQUAL", "OP_EQUALVERIFY"],

  // Arithmetic
  arithmetic: ["OP_1ADD", "OP_1SUB", "OP_2MUL", "OP_2DIV", "OP_NEGATE", "OP_ABS", "OP_NOT", "OP_0NOTEQUAL", "OP_ADD", "OP_SUB", "OP_MUL", "OP_DIV", "OP_MOD", "OP_LSHIFT", "OP_RSHIFT", "OP_BOOLAND", "OP_BOOLOR", "OP_NUMEQUAL", "OP_NUMEQUALVERIFY", "OP_NUMNOTEQUAL", "OP_LESSTHAN", "OP_GREATERTHAN", "OP_LESSTHANOREQUAL", "OP_GREATERTHANOREQUAL", "OP_MIN", "OP_MAX", "OP_WITHIN"],

  // Crypto operations
  crypto: ["OP_RIPEMD160", "OP_SHA1", "OP_SHA256", "OP_HASH160", "OP_HASH256", "OP_CODESEPARATOR", "OP_CHECKSIG", "OP_CHECKSIGVERIFY", "OP_CHECKMULTISIG", "OP_CHECKMULTISIGVERIFY", "OP_CHECKDATASIG", "OP_CHECKDATASIGVERIFY"],

  // Locktime
  locktime: ["OP_CHECKLOCKTIMEVERIFY", "OP_CHECKSEQUENCEVERIFY"],
};

// Flatten all opcodes for quick lookup
const ALL_OPCODES = new Set([...OPCODES.constants, ...OPCODES.flow, ...OPCODES.stack, ...OPCODES.splice, ...OPCODES.bitwise, ...OPCODES.arithmetic, ...OPCODES.crypto, ...OPCODES.locktime]);

// Format script with syntax highlighting
function formatScriptAsm(script: string): { type: string; content: string }[] {
  const lines = script.split("\n");
  const tokens: { type: string; content: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      tokens.push({ type: "newline", content: "\n" });
      continue;
    }

    // Comments
    if (line.startsWith("//")) {
      tokens.push({ type: "comment", content: line });
      if (i < lines.length - 1) tokens.push({ type: "newline", content: "\n" });
      continue;
    }

    // Split line into words
    const words = line.split(/(\s+)/);

    for (const word of words) {
      if (!word.trim()) {
        tokens.push({ type: "whitespace", content: word });
        continue;
      }

      const upperWord = word.toUpperCase();

      // Check opcode categories
      if (OPCODES.crypto.includes(upperWord)) {
        tokens.push({ type: "crypto", content: word });
      } else if (OPCODES.arithmetic.includes(upperWord)) {
        tokens.push({ type: "arithmetic", content: word });
      } else if (OPCODES.stack.includes(upperWord)) {
        tokens.push({ type: "stack", content: word });
      } else if (OPCODES.flow.includes(upperWord)) {
        tokens.push({ type: "flow", content: word });
      } else if (OPCODES.locktime.includes(upperWord)) {
        tokens.push({ type: "locktime", content: word });
      } else if (OPCODES.constants.includes(upperWord)) {
        tokens.push({ type: "constant", content: word });
      } else if (OPCODES.bitwise.includes(upperWord)) {
        tokens.push({ type: "bitwise", content: word });
      } else if (word.match(/^0x[a-fA-F0-9]+$/)) {
        // Hex data
        tokens.push({ type: "hex", content: word });
      } else if (word.match(/^\d+$/)) {
        // Numbers
        tokens.push({ type: "number", content: word });
      } else {
        // Default
        tokens.push({ type: "default", content: word });
      }
    }

    if (i < lines.length - 1) {
      tokens.push({ type: "newline", content: "\n" });
    }
  }

  return tokens;
}

export default function ScriptEditor({ value, onChange, onPaste, placeholder, rows = 12, className = "" }: ScriptEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Sync scroll positions
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      setScrollTop(scrollTop);
      setScrollLeft(scrollLeft);
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  };

  // Format the script for highlighting
  const formattedTokens = formatScriptAsm(value || "");

  const highlightedContent = formattedTokens.map((token, index) => {
    switch (token.type) {
      case "comment":
        return (
          <span key={index} className="text-gray-500 italic">
            {token.content}
          </span>
        );
      case "crypto":
        return (
          <span key={index} className="text-red-400 font-bold">
            {token.content}
          </span>
        );
      case "arithmetic":
        return (
          <span key={index} className="text-blue-400 font-bold">
            {token.content}
          </span>
        );
      case "stack":
        return (
          <span key={index} className="text-green-400 font-bold">
            {token.content}
          </span>
        );
      case "flow":
        return (
          <span key={index} className="text-purple-400 font-bold">
            {token.content}
          </span>
        );
      case "locktime":
        return (
          <span key={index} className="text-orange-400 font-bold">
            {token.content}
          </span>
        );
      case "constant":
        return (
          <span key={index} className="text-yellow-400 font-bold">
            {token.content}
          </span>
        );
      case "bitwise":
        return (
          <span key={index} className="text-pink-400 font-bold">
            {token.content}
          </span>
        );
      case "hex":
        return (
          <span key={index} className="text-cyan-300">
            {token.content}
          </span>
        );
      case "number":
        return (
          <span key={index} className="text-amber-300">
            {token.content}
          </span>
        );
      case "newline":
        return <br key={index} />;
      case "whitespace":
        return <span key={index}>{token.content}</span>;
      default:
        return (
          <span key={index} className="text-gray-300">
            {token.content}
          </span>
        );
    }
  });

  return (
    <div className="relative">
      {/* Syntax highlighted background */}
      <pre
        ref={highlightRef}
        className={`absolute inset-0 p-4 font-mono text-sm whitespace-pre-wrap overflow-hidden pointer-events-none bg-gray-900 border border-gray-700 rounded-lg ${className}`}
        style={{
          lineHeight: "1.5",
          transform: `translate(-${scrollLeft}px, -${scrollTop}px)`,
        }}
        aria-hidden="true"
      >
        <code>{highlightedContent}</code>
      </pre>

      {/* Invisible textarea for input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste ? (e) => onPaste(e, onChange, value) : undefined}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        rows={rows}
        className={`relative w-full p-4 font-mono text-sm bg-transparent text-transparent caret-white border border-gray-700 rounded-lg resize-none outline-none ${className}`}
        style={{
          lineHeight: "1.5",
          caretColor: "white",
        }}
        spellCheck={false}
      />

      {/* Focus border overlay */}
      {isFocused && <div className="absolute inset-0 border-2 border-orange-500 rounded-lg pointer-events-none"></div>}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-400 rounded"></span>
          <span className="text-gray-600">Crypto</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-400 rounded"></span>
          <span className="text-gray-600">Math</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-400 rounded"></span>
          <span className="text-gray-600">Stack</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-400 rounded"></span>
          <span className="text-gray-600">Flow</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-400 rounded"></span>
          <span className="text-gray-600">Time</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-cyan-300 rounded"></span>
          <span className="text-gray-600">Hex</span>
        </div>
      </div>
    </div>
  );
}
