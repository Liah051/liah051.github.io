import { visit } from "unist-util-visit";

export default function remarkStrongJsx() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!node.children || !Array.isArray(node.children)) return;

      const children = node.children;
      const newChildren: any[] = [];
      let i = 0;

      while (i < children.length) {
        const child = children[i];

        // 太字の処理: textノードで、値が "**" を含む
        if (child.type === "text" && child.value.includes("**")) {
          const val = child.value;
          const firstIdx = val.indexOf("**");
          const secondIdx = val.indexOf("**", firstIdx + 2);

          // 同一テキストノード内に開始と閉じの "**" が両方存在する場合
          if (secondIdx !== -1) {
            // 1. 太字の前のテキスト
            const beforeText = val.slice(0, firstIdx);
            if (beforeText) {
              newChildren.push({ type: "text", value: beforeText });
            }

            // 2. 太字ノード
            const innerText = val.slice(firstIdx + 2, secondIdx);
            newChildren.push({
              type: "strong",
              children: [{ type: "text", value: innerText }],
            });

            // 3. 太字の後のテキストを次の処理に残す
            const afterText = val.slice(secondIdx + 2);
            child.value = afterText;
            continue;
          }

          const startNode = child;
          const startVal = startNode.value;
          const startIdx = startVal.lastIndexOf("**");

          // 閉じの "**" を探す
          let foundClose = false;
          let closeIndex = -1;
          let endIdx = -1;

          for (let j = i + 1; j < children.length; j++) {
            const nextChild = children[j];
            if (nextChild.type === "text") {
              const val = nextChild.value;
              const idx = val.indexOf("**");
              if (idx !== -1) {
                foundClose = true;
                closeIndex = j;
                endIdx = idx;
                break;
              }
            }
          }

          if (foundClose) {
            const endNode = children[closeIndex];
            const endVal = endNode.value;

            // 1. 太字の前のテキスト（開始ノードの外側）
            const beforeText = startVal.slice(0, startIdx);
            if (beforeText) {
              newChildren.push({ type: "text", value: beforeText });
            }

            // 2. 太字の内側のテキスト/ノード（innerChildren）
            const innerChildren: any[] = [];
            
            // 開始ノードの太字内テキスト
            const startInnerText = startVal.slice(startIdx + 2);
            if (startInnerText) {
              innerChildren.push({ type: "text", value: startInnerText });
            }

            // 中間のノード群
            for (let k = i + 1; k < closeIndex; k++) {
              innerChildren.push(children[k]);
            }

            // 閉じノードの太字内テキスト
            const endInnerText = endVal.slice(0, endIdx);
            if (endInnerText) {
              innerChildren.push({ type: "text", value: endInnerText });
            }

            // 太字ノード（strong）を作成して追加
            newChildren.push({
              type: "strong",
              children: innerChildren,
            });

            // 3. 太字の後のテキスト（閉じノードの外側）
            const afterText = endVal.slice(endIdx + 2);
            
            // 閉じノードの残りを次のループ処理のために更新
            endNode.value = afterText;
            i = closeIndex;
            
            continue;
          }
        }

        // 閉じが見つからなかった、または太字対象でなかった場合は、そのまま newChildren に追加
        newChildren.push(child);
        i++;
      }

      node.children = newChildren;
    });
  };
}
