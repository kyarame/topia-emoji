// import { tw } from 'twind';
// import { useEffect, useMemo, useRef, useState } from 'react';
// import { XMLValidator } from 'fast-xml-parser';

import { useDrag, useGesture } from "@use-gesture/react";
import classNames from "classnames";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { nanoid } from "nanoid";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
  useCallback,
  ChangeEvent,
  useMemo,
} from "react";
import { useForm } from "react-hook-form";
import { type Rect, useRect } from "react-use-rect";
import twemoji from "twemoji";
import ColorPicker, { Color } from "./components/ColorPicker";
import {
  EmojiTemplateChar,
  emojiTemplates,
  isEmojiSupported,
} from "./constants";
import { copyToClipboard } from "./utils";

const FILLER = "\u200b"; // TODO: as a customisable option
const MINIFICATION_FLAG = false;

type TokenContent = {
  id: string;
  template?: EmojiTemplateChar;
  value: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: Color;
};

interface TokenProps {
  rectUpdateCount: number;
  token: TokenContent;
  setRects: Dispatch<SetStateAction<Record<string, Rect>>>;
  selected: boolean;
  onContextMenu?: (xy: [number, number]) => void;
}

const Token = ({
  rectUpdateCount,
  token,
  setRects,
  selected,
  onContextMenu,
}: TokenProps) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [rectRef] = useRect(setRect);

  useEffect(() => {
    if (!rectUpdateCount || !rect) return;
    setRects((rects) => ({
      ...rects,
      [token.id]: rect,
    }));
  }, [rectUpdateCount]);

  const fontSize = token.fontSize ?? 24;

  return (
    <div
      ref={rectRef}
      className={classNames(
        "flex flex-col justify-end py-0.5 px-0.5 rounded-md bg-white/20 text-white leading-[1.1] select-none min-w-[2rem]",
        selected && "ring-2 ring-blue-500"
      )}
      style={{
        fontSize,
        height: Math.max(1.1 * fontSize, 16),
        color: token.color?.toHex(MINIFICATION_FLAG),
        fontWeight: token.bold ? "bold" : "normal",
        fontStyle: token.italic ? "italic" : "normal",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.([e.clientX, e.clientY]);
      }}
    >
      {isEmojiSupported(token.value)
        ? (() => {
            const template = emojiTemplates[token.template ?? "M"];
            const src = twemoji
              .parse(token.value)
              .match(/"(https:\/\/.*?)"/)![1];

            return (
              <span
                className="relative"
                style={{
                  width:
                    (template.width -
                      Math.min(template.left, 0) -
                      Math.min(template.right, 0)) *
                    fontSize,
                  height: 1.1 * fontSize,
                }}
              >
                <div
                  className={classNames(
                    "bg-red-500/30 rounded-l absolute",
                    template.width == 0 && "border-r border-gray-700/30"
                  )}
                  style={{
                    left: 0,
                    bottom: 0,
                    width: Math.max(-template.left, 0) * fontSize,
                    height: Math.max(1.1 * fontSize, 16) - 4,
                  }}
                />
                <div
                  className="bg-red-500/30 rounded-r absolute"
                  style={{
                    right: 0,
                    bottom: 0,
                    width: Math.max(-template.right, 0) * fontSize,
                    height: Math.max(1.1 * fontSize, 16) - 4,
                  }}
                />
                <img
                  className="absolute pointer-events-none"
                  src={src}
                  style={{
                    left: Math.max(template.left, 0) * fontSize,
                    top: template.top * fontSize,
                    width:
                      (template.width - template.left - template.right) *
                      fontSize,
                    height: (1 - template.top - template.bottom) * fontSize,
                  }}
                />
              </span>
            );
          })()
        : token.value}
    </div>
  );
};

interface TokenListProps {
  tokens: TokenContent[];
  setSelectedTokenIds: (ids: string[]) => void;
  onAddBefore: (token: TokenContent) => void;
  onAddAfter: (token: TokenContent) => void;
  onRemove: (token: TokenContent) => void;
}

const TokenList = ({
  tokens,
  setSelectedTokenIds,
  onAddBefore,
  onAddAfter,
  onRemove,
}: TokenListProps) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [rectRef] = useRect(setRect);
  const [rects, setRects] = useState<Record<string, Rect>>({});

  const [tokenRange, setTokenRange] = useState<[number, number] | null>(null);
  const [rectUpdateCount, setRectUpdateCount] = useState(0);

  useEffect(() => {
    setRectUpdateCount((c) => c + 1);
  }, [tokens, rect]);

  const getChildRectEntryFromXY = useCallback(
    ([x, y]: [number, number]) => {
      return tokens
        .map((token, i) => [i, rects[token.id]] as const)
        .find(
          ([, r]) => r.left <= x && r.right >= x && r.top <= y && r.bottom >= y
        );
    },
    [rects]
  );

  const [contextMenuProps, setContextMenuProps] = useState<{
    position: [number, number];
    token: TokenContent;
  } | null>(null);

  const bind = useGesture({
    onDragStart({ xy }) {
      if (contextMenuProps) return;
      const childEntry = getChildRectEntryFromXY(xy);
      if (!childEntry) return;

      const [tokenIndex] = childEntry;
      setTokenRange([tokenIndex, tokenIndex]);
    },
    onDrag({ xy }) {
      const childEntry = getChildRectEntryFromXY(xy);
      if (!childEntry) return;

      const [tokenIndex] = childEntry;
      setTokenRange((prev) => (prev ? [prev[0], tokenIndex] : prev));
    },
    onDragEnd({ xy }) {
      const childEntry = getChildRectEntryFromXY(xy);

      if (!tokenRange || !childEntry) return tokenRange;

      const [tokenIndex] = childEntry;

      const beginIndex = Math.min(tokenRange[0], tokenIndex);
      const endIndex = Math.max(tokenRange[0], tokenIndex);

      setSelectedTokenIds(
        tokens.slice(beginIndex, endIndex + 1).map((t) => t.id)
      );

      setTokenRange([beginIndex, endIndex]);
    },
  });

  return (
    <div
      ref={rectRef}
      {...bind()}
      className="w-fit h-fit max-w-full flex flex-wrap gap-0.5 vertical-middle touch-none relative items-end"
    >
      {tokens.map((token, tokenIndex) => (
        <Token
          key={token.id}
          rectUpdateCount={rectUpdateCount}
          setRects={setRects}
          token={token}
          selected={
            !!tokenRange &&
            tokenIndex >= Math.min(tokenRange[0], tokenRange[1]) &&
            tokenIndex <= Math.max(tokenRange[0], tokenRange[1])
          }
          onContextMenu={(xy) => {
            setContextMenuProps({ position: xy, token });
          }}
        />
      ))}

      {contextMenuProps && (
        <div
          className={classNames(
            "bg-gray-900/50 fixed w-full h-full top-0 left-0 transition-opacity z-20",
            !!contextMenuProps ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) setContextMenuProps(null);
          }}
        >
          <div
            className="absolute bg-gray-700 shadow rounded-md w-40 overflow-clip flex flex-col text-white text-sm leading-7"
            style={{
              left: contextMenuProps.position[0],
              top: contextMenuProps.position[1],
            }}
          >
            <button
              className="hover:bg-gray-600 active:bg-gray-600 transition-colors"
              onClick={() => {
                const index = tokens.findIndex(
                  (t) => t.id === contextMenuProps.token.id
                );
                setTokenRange([index, index]);
                onAddBefore(contextMenuProps.token);
                setContextMenuProps(null);
              }}
            >
              前にトークン追加
            </button>
            <button
              className="hover:bg-gray-600 active:bg-gray-600 transition-colors"
              onClick={() => {
                const index =
                  tokens.findIndex((t) => t.id === contextMenuProps.token.id) +
                  1;
                setTokenRange([index, index]);
                onAddAfter(contextMenuProps.token);
                setContextMenuProps(null);
              }}
            >
              後ろにトークン追加
            </button>
            <button
              className="hover:bg-gray-600 text-red-400 active:bg-gray-600 transition-colors"
              onClick={() => {
                const index = tokens.findIndex(
                  (t) => t.id === contextMenuProps.token.id
                );
                setTokenRange([index, index]);
                onRemove(contextMenuProps.token);
                setContextMenuProps(null);
              }}
            >
              トークン削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const tokensAtom = atomWithStorage<TokenContent[]>("tokens", [
  { id: nanoid(), value: "" },
]);

const App = () => {
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [tokens, setTokens] = useAtom(tokensAtom);

  const defaultValues = useMemo(() => {
    if (selectedTokenIds.length === 0) {
      return {
        textContent: "",
        emojiTemplate: "",
        fontSize: 24,
        bold: false,
        italic: false,
        color: null as Color | null,
      };
    }

    const getCommonProperty = <T extends keyof TokenContent>(
      key: T
    ): TokenContent[T] | null => {
      const values = selectedTokenIds
        .map((id) => (tokens as TokenContent[]).find((t) => t.id === id))
        .filter((t): t is TokenContent => t !== undefined)
        .map((t) => t[key]);
      const firstValue = values[0];
      if (
        values.every(
          (v) => v === firstValue || v?.toString() === firstValue?.toString()
        )
      ) {
        return firstValue;
      }
      return null;
    };

    return {
      textContent: getCommonProperty("value"),
      emojiTemplate: getCommonProperty("template") ?? "",
      fontSize: getCommonProperty("fontSize"),
      bold: getCommonProperty("bold") ?? false,
      italic: getCommonProperty("italic") ?? false,
      color: getCommonProperty("color") ?? (null as Color | null),
    };
  }, [selectedTokenIds, tokens]);

  const { color: colorDefaultValue, ...defaultValuesWithoutColor } =
    defaultValues;
  const { register, setValue } = useForm({
    defaultValues: defaultValuesWithoutColor,
  });
  const [color, setColor] = useState<Color | null>(null);

  useEffect(() => {
    const { color: colorDefaultValue, ...defaultValuesWithoutColor } =
      defaultValues;

    for (const key in defaultValuesWithoutColor) {
      setValue(
        key as keyof typeof defaultValuesWithoutColor,
        defaultValuesWithoutColor[key as keyof typeof defaultValuesWithoutColor]
      );
    }
    setColor(colorDefaultValue);
  }, [defaultValues]);

  const separator = <div className="h-px w-full bg-gray-600" />;

  return (
    <div className="flex flex-col max-w-lg w-full bg-gray-800 rounded-xl shadow-xl p-3 gap-4">
      <div
        className="w-[calc(100%+24px)] -translate-x-3 p-3 -my-3 hover:bg-gray-700 rounded-xl transition-colors cursor-pointer select-none"
        onClick={() => {
          const prefixTags: string[] = [];
          const tags: string[] = [];
          let numberOfCharactersBeforeEmoji = Array.from(
            tokens.map((token) => token.value).join("")
          ).filter((x) => isEmojiSupported(x)).length;

          // 1. first, gather the tokens by their colors
          const tokensByColor = tokens.reduce(
            (acc, token) => {
              if (
                acc
                  .at(-1)!
                  .slice(0, 1)
                  .every(
                    (t) =>
                      t.color?.toHex(MINIFICATION_FLAG) ===
                        token.color?.toHex(MINIFICATION_FLAG) ||
                      isEmojiSupported(t.value) ||
                      isEmojiSupported(token.value)
                  )
              ) {
                acc.at(-1)!.push(token);
              } else {
                acc.push([token]);
              }
              return acc;
            },
            [[]] as TokenContent[][]
          );

          // 2. then, generate the tags
          for (const tokens of tokensByColor) {
            const color = tokens.filter((t) => !isEmojiSupported(t.value))[0]
              ?.color;

            // 2-1. gather tokens by their font sizes
            const tokensByFontSize = tokens.reduce(
              (acc, token) => {
                if (
                  acc
                    .at(-1)!
                    .slice(0, 1)
                    .every((t) => (t.fontSize ?? 24) === (token.fontSize ?? 24))
                ) {
                  acc.at(-1)!.push(token);
                } else {
                  acc.push([token]);
                }
                return acc;
              },
              [[]] as TokenContent[][]
            );

            for (const tokens of tokensByFontSize) {
              const fontSize = tokens[0].fontSize ?? 24;

              const applyColor = (s: string) =>
                !color ||
                color.toHex(MINIFICATION_FLAG) === "#ffffff" ||
                color.toHex(MINIFICATION_FLAG) === "#fff"
                  ? s
                  : `<color=${color.toHex(MINIFICATION_FLAG)}>${s}</color>`;
              const applyFontSize = (s: string) =>
                fontSize === 24 ? s : `<size=${fontSize}>${s}</size>`;
              const applyBold =
                (applyOrNot: boolean = false) =>
                (s: string) =>
                  applyOrNot ? `<b>${s}</b>` : s;
              const applyItalic =
                (applyOrNot: boolean = false) =>
                (s: string) =>
                  applyOrNot ? `<i>${s}</i>` : s;

              tags.push(
                applyColor(
                  applyFontSize(
                    tokens
                      .map((t) => {
                        let fillerLength = 0;
                        if (!isEmojiSupported(t.value)) {
                          numberOfCharactersBeforeEmoji += t.value.length;
                        } else {
                          const diff = 7 - numberOfCharactersBeforeEmoji;
                          fillerLength = Math.max(0, diff);
                          const prefixFillerLength = Math.max(0, -diff);
                          prefixTags.push(
                            `<size=1${".".repeat(prefixFillerLength)}${t.value}`
                          );
                          numberOfCharactersBeforeEmoji = 0;
                        }
                        const filler = FILLER.repeat(fillerLength);

                        return (
                          filler +
                          applyBold(t.bold)(
                            applyItalic(t.italic)(
                              isEmojiSupported(t.value)
                                ? t.template ?? "M"
                                : t.value
                            )
                          )
                        );
                      })
                      .join("")
                      .replaceAll("</b><b>", "")
                      .replaceAll("</i><i>", "")
                  )
                )
              );
            }
          }

          copyToClipboard(prefixTags.join("") + tags.join(""));
        }}
      >
        <div className="font-bold text-white/75 text-xs">
          プレビュー（タップして弾幕コピー）
        </div>
        <div className="w-full text-white">
          {tokens.map((token) =>
            isEmojiSupported(token.value) ? (
              (() => {
                const template = emojiTemplates[token.template ?? "M"];
                const src = twemoji
                  .parse(token.value)
                  .match(/"(https:\/\/.*?)"/)![1];
                const fontSize = token.fontSize ?? 24;
                const width =
                  (template.width - template.left - template.right) * fontSize;

                return (
                  <span
                    key={token.id}
                    className="relative inline-block"
                    style={{
                      width: template.width * fontSize,
                      height: 1.1 * fontSize,
                      verticalAlign: (-1 / 4) * fontSize,
                    }}
                  >
                    <img
                      className="absolute inline-block pointer-events-none"
                      src={src}
                      style={{
                        left: template.left * fontSize,
                        top: template.top * fontSize,
                        width,
                        minWidth: width,
                        maxWidth: width,
                        height: (1 - template.top - template.bottom) * fontSize,
                      }}
                    />
                  </span>
                );
              })()
            ) : (
              <span
                key={token.id}
                className="whitespace-pre"
                style={{
                  fontSize: token.fontSize ?? 24,
                  lineHeight: 1.1,
                  fontWeight: token.bold ? "bold" : "normal",
                  fontStyle: token.italic ? "italic" : "normal",
                  color: token.color?.toHex(MINIFICATION_FLAG) ?? "white",
                }}
              >
                {token.value}
              </span>
            )
          )}
        </div>
      </div>
      {separator}
      <div className="w-full">
        <div className="font-bold text-white/75 text-xs mb-3">
          トークンリスト
        </div>
        <TokenList
          setSelectedTokenIds={setSelectedTokenIds}
          tokens={tokens}
          onAddBefore={(token) => {
            setTokens((tokens) => {
              const index = tokens.findIndex((t) => t.id === token.id);
              return [
                ...tokens.slice(0, index),
                {
                  id: nanoid(),
                  value: "",
                },
                ...tokens.slice(index),
              ];
            });
          }}
          onAddAfter={(token) => {
            setTokens((tokens) => {
              const index = tokens.findIndex((t) => t.id === token.id);
              return [
                ...tokens.slice(0, index + 1),
                {
                  id: nanoid(),
                  value: "",
                },
                ...tokens.slice(index + 1),
              ];
            });
          }}
          onRemove={(token) => {
            setTokens((tokens) => {
              const index = tokens.findIndex((t) => t.id === token.id);
              const result = [
                ...tokens.slice(0, index),
                ...tokens.slice(index + 1),
              ];
              if (result.length === 0)
                return [
                  {
                    id: nanoid(),
                    value: "",
                  },
                ];
              return result;
            });
          }}
        />
      </div>
      {separator}
      <div
        className={classNames(
          "w-full grid gap-y-2",
          selectedTokenIds.length === 0 && "opacity-30 pointer-events-none"
        )}
        style={{
          gridTemplateColumns: "6rem 1fr",
        }}
      >
        <div className="row-span-1 col-span-1 text-right pr-3">
          <label className="text-white/75 font-bold text-xs leading-8">
            内容
          </label>
        </div>
        <div className="row-span-1 col-span-1">
          <input
            placeholder={defaultValues.textContent === "" ? "空白の文字列" : ""}
            className="w-full border border-gray-600 bg-gray-800 text-white rounded-md px-2 h-8"
            {...register("textContent", {
              onChange(e: ChangeEvent<HTMLInputElement>) {
                const regexpUnicodeModified =
                  /\p{RI}\p{RI}|\p{Emoji}(\p{EMod}+|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?(\u{200D}\p{Emoji}(\p{EMod}+|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?)+|\p{EPres}(\p{EMod}+|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?|\p{Emoji}(\p{EMod}+|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})/gu;

                const value = isEmojiSupported(e.target.value)
                  ? e.target.value
                  : e.target.value.replace(regexpUnicodeModified, "");
                setTokens((tokens) =>
                  tokens.map((token) =>
                    selectedTokenIds.includes(token.id)
                      ? { ...token, value }
                      : token
                  )
                );
              },
            })}
          />
        </div>

        <div className="row-span-1 col-span-1 text-right pr-3">
          <label className="text-white/75 font-bold text-xs leading-8">
            テンプレート
          </label>
        </div>
        <div
          className={classNames(
            "row-span-1 col-span-1",
            !tokens
              .filter((token) => selectedTokenIds.includes(token.id))
              .every((token) => isEmojiSupported(token.value)) &&
              "opacity-30 pointer-events-none"
          )}
        >
          <select
            className="w-full border border-gray-600 bg-gray-800 text-white rounded-md px-2 h-8"
            {...register("emojiTemplate", {
              onChange(e: ChangeEvent<HTMLSelectElement>) {
                const template = e.target.value as EmojiTemplateChar;
                setTokens((tokens) =>
                  tokens.map((token) =>
                    selectedTokenIds.includes(token.id)
                      ? { ...token, template }
                      : token
                  )
                );
              },
            })}
          >
            {Object.keys(emojiTemplates).map((char) => (
              <option key={char} value={char}>{`　${char}　`}</option>
            ))}
          </select>
        </div>

        <div className="row-span-1 col-span-1 text-right pr-3">
          <label className="text-white/75 font-bold text-xs leading-8">
            サイズ
          </label>
        </div>
        <div className="row-span-1 col-span-1">
          <input
            type="number"
            min={2}
            max={200}
            step={1}
            className="w-full border border-gray-600 bg-gray-800 text-white rounded-md px-2 h-8 invalid:bg-red-800"
            {...register("fontSize", {
              min: 2,
              max: 200,
              onChange(e: ChangeEvent<HTMLInputElement>) {
                if (!e.target.validity.valid) return;
                const fontSize = parseInt(e.target.value);
                setTokens((tokens) =>
                  tokens.map((token) =>
                    selectedTokenIds.includes(token.id)
                      ? { ...token, fontSize }
                      : token
                  )
                );
              },
            })}
          />
        </div>

        <div className="row-span-1 col-span-1 text-right pr-3">
          <label className="text-white/75 font-bold text-xs leading-6">
            スタイル
          </label>
        </div>
        <div className="row-span-1 col-span-1 space-x-4">
          <label className="space-x-2">
            <input
              type="checkbox"
              {...register("bold", {
                onChange(e: ChangeEvent<HTMLInputElement>) {
                  const bold = e.target.checked;
                  setTokens((tokens) =>
                    tokens.map((token) =>
                      selectedTokenIds.includes(token.id)
                        ? { ...token, bold }
                        : token
                    )
                  );
                },
              })}
            />
            <span className="text-white leading-6">太く</span>
          </label>
          <label className="space-x-2">
            <input
              type="checkbox"
              {...register("italic", {
                onChange(e: ChangeEvent<HTMLInputElement>) {
                  const italic = e.target.checked;
                  setTokens((tokens) =>
                    tokens.map((token) =>
                      selectedTokenIds.includes(token.id)
                        ? { ...token, italic }
                        : token
                    )
                  );
                },
              })}
            />
            <span className="text-white leading-6">傾ける</span>
          </label>
        </div>

        <div className="row-span-1 col-span-1 text-right pr-3">
          <label className="text-white/75 font-bold text-sm leading-8">
            色
          </label>
        </div>
        <div className="row-span-1 col-span-1 relative">
          <ColorPicker
            color={color}
            setColor={(color) => {
              setColor(color);
              setTokens((tokens) =>
                tokens.map((token) =>
                  selectedTokenIds.includes(token.id)
                    ? {
                        ...token,
                        color: isEmojiSupported(token.value)
                          ? undefined
                          : color.clone(),
                      }
                    : token
                )
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
