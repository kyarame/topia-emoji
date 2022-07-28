import { tw } from "twind";
import { useEffect, useMemo, useRef, useState } from "react";
import { XMLValidator } from "fast-xml-parser";

const singleEmojiRegex =
  /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/ug;

function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    const msg = successful ? "successful" : "unsuccessful";
    console.log("Fallback: Copying text command was " + msg);
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err);
  }

  document.body.removeChild(textArea);
}
function copyToClipboard(text: string) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function () {
    console.log("Async: Copying to clipboard was successful!");
  }, function (err) {
    console.error("Async: Could not copy text: ", err);
  });
}

function log<T>(value: T): T {
  console.log(value);
  return value;
}

function App() {
  return (
    <div
      className={tw
        `flex(& col) w-full max-w-md rounded-xl overflow-hidden shadow-xl bg-white`}
    >
      <Textarea />
      <div className={tw`px-4 space-y-1 py-3`}>
        <h2 className={tw`text-xs font-bold text-gray-500`}>結果</h2>
        <div
          id="__preview"
          className={tw`w-full break-all`}
          style={{ minHeight: "24px" }}
        />
      </div>
      <Code />
    </div>
  );
}

const Code = () => {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const copiedCount = useRef(0);

  return (
    <div
      className={tw`px-4 space-y-1 py-3 bg-${
        copied ? "green(100 hover:200)" : "gray(hover:100)"
      } transition-colors cursor-pointer`}
      onClick={() => {
        const textContent = document.getElementById("__code")?.textContent ??
          "";
        setCode("");
        copyToClipboard(textContent);
        console.log(textContent);
        copiedCount.current += 1;
        const count = copiedCount.current;
        setCopied(true);
        setTimeout(() => {
          if (copiedCount.current === count) {
            setCopied(false);
          }
        }, 1000);
      }}
    >
      <h2 className={tw`text-xs font-bold text-gray-500`}>弾幕コード（タップしてコピー）</h2>
      <div
        id="__code"
        className={tw`w-full break-all font-mono`}
        style={{ minHeight: "24px" }}
      >
        {code}
      </div>
    </div>
  );
};

const Textarea = () => {
  const sizingElement = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState(
    document.querySelector("textarea")?.value ??
      localStorage.getItem("value") ?? "<size=50>😏</size>",
  );
  const isValid = useMemo(
    () =>
      XMLValidator.validate(
        `<root>${
          value
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll(
              /(?:&lt;)((size)=\d+|(color)=.+?|(\/size|\/color|\/?b|\/?i))&gt;/g,
              "<$2$3$4>",
            )
        }</root>`,
      ) ===
        true,
    [value],
  );

  function resize() {
    if (sizingElement.current) {
      sizingElement.current.innerText = value;
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textarea.style.height = `${
          Math.max(40, sizingElement.current.scrollHeight)
        }px`;
      }
    }
  }

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => {
    setTimeout(() => resize(), 10);
    setTimeout(() => resize(), 50);
    setTimeout(() => resize(), 100);
    setTimeout(() => resize(), 500);
    setTimeout(() => resize(), 1000);
  }, []);

  function render(value: string) {
    renderPreview(value);
    renderCode(value);
  }

  function renderPreview(value: string) {
    const html = value.replaceAll(
      /<size=(\d+)>/g,
      '[span style="font-size: calc(0.666 * min($1px, 200px)); line-height: 120%;"]',
    ).replaceAll(/<\/size>/g, "[/span]")
      .replaceAll(/<color=(.+?)>/g, '[span style="color: $1"]')
      .replaceAll(/<\/color>/g, "[/span]")
      .replaceAll(/<b>/g, '[span style="font-weight: bold"]')
      .replaceAll(/<\/b>/g, "[/span]")
      .replaceAll(/<i>/g, '[span style="font-style: italic"]')
      .replaceAll(/<\/i>/g, "[/span]")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll(/\[span(.+?)\]/g, "<span$1>")
      .replaceAll(/\[\/span\]/g, "</span>");

    const preview = document.getElementById("__preview");
    if (preview) {
      preview.innerHTML = html;
    }
  }

  function renderCode(value: string) {
    const preview = document.getElementById("__preview");
    const code = document.getElementById("__code");
    if (preview && code) {
      if (!value.includes("<size")) {
        code.textContent = value;
        return;
      }
      const textContent = preview.textContent ?? "";

      const match = Array.from(
        textContent.matchAll(singleEmojiRegex),
      );

      if (!match.length) {
        code.textContent = value;
        return;
      }

      const array = Array.from(textContent).filter((x) => x != "\ufe0f");
      console.log(array);
      const firstEmoji = array.findIndex((char) =>
        char.match(singleEmojiRegex)
      );
      const lastEmoji = array.length - 1 -
        [...array].reverse().findIndex((char) => char.match(singleEmojiRegex));

      const n = lastEmoji - 7;

      const joiner = "\u200b";
      //const joiner = ".";
      const newCode = `<color=#0000><size=02${joiner.repeat(Math.max(0, n))}${
        array.slice(firstEmoji, lastEmoji + 1).map((char) =>
          char.match(/\p{Extended_Pictographic}/gu) ? char : joiner
        ).join("")
      }${joiner.repeat(Math.max(0, -n))}</color>${
        log(
          Array.from(value).flatMap((char, index, arr) =>
            char.match(
                /\p{Extended_Pictographic}/gu,
              )
              ? log([...char]).map((c) =>
                c.match(
                    /\p{Extended_Pictographic}/gu,
                  )
                  ? "◯️"
                  : joiner
              )
              : char
          ),
        ).join("")
      }`;

      code.innerText = newCode;
    }
  }

  useEffect(() => {
    if (isValid) {
      render(value);
    }
  }, [value, isValid]);

  useEffect(() => {
    if (isValid) {
      setTimeout(() => render(value), 10);
      setTimeout(() => render(value), 50);
      setTimeout(() => render(value), 100);
      setTimeout(() => render(value), 500);
      setTimeout(() => render(value), 1000);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("value", value);
  }, [value]);

  return (
    <div
      className={tw`flex flex-col relative w-full bg-${
        isValid ? "gray" : "red"
      }(200 hover:300) transition-colors px-4 pt-3 cursor-text`}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName.toLowerCase() !== "textarea") {
          e.preventDefault();
          document.querySelector("textarea")?.focus();
        }
      }}
    >
      <div
        ref={sizingElement}
        className={tw
          `absolute top-0 left-0 -z-10 w-full break-all px-3 py-2 pointer-events-none leading-normal font-mono`}
      />
      <h2 className={tw`text-xs font-bold text-gray-500`}>入力</h2>
      <textarea
        className={tw
          `w-full font-mono box-border resize-none pt-1 pb-3 overflow-hidden outline-none break-all leading-normal bg-transparent`}
        onInput={(e) => {
          const selectionStart = e.currentTarget.selectionStart;
          const selectionEnd = e.currentTarget.selectionEnd;
          const gap =
            e.currentTarget.value.slice(0, selectionEnd).replace(/[^\n]/g, "")
              .length;
          e.currentTarget.value = e.currentTarget.value.replaceAll("\n", "");
          setValue(e.currentTarget.value);
          e.currentTarget.selectionStart = selectionStart - gap;
          e.currentTarget.selectionEnd = selectionEnd - gap;

          render(e.currentTarget.value);
        }}
      >
        {value}
      </textarea>
    </div>
  );
};

export default App;
