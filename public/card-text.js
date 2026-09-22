const escape = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function skillTone(label) {
  if (/ผู้นำ|リーダー/.test(label)) return "leader";
  if (/เลเวล|レベル/.test(label)) return "level";
  if (/ตัดสิน|判定|ประลอง|対抗/.test(label)) return "judgment";
  if (/ต่อเนื่อง|ไล่โจมตี|追撃|連撃|コンボ/.test(label)) return "combo";
  if (/เข้าสนาม|登場|สลับ|交代/.test(label)) return "entry";
  return "timing";
}
export function formatCardText(text) {
  return String(text ?? "")
    .split("\n")
    .map(
      (line) =>
        '<span class="effect-line">' +
        line
          .split(
            /(【[^】]+】|สีแดง|สีเขียว|สีน้ำเงิน|สีฟ้า|赤色|緑色|青色|[+＋−-]?\d+)/g,
          )
          .map((token) => {
            if (/^【[^】]+】$/.test(token))
              return (
                '<strong class="skill-tag skill-' +
                skillTone(token) +
                '">' +
                escape(token) +
                "</strong>"
              );
            const color = {
              สีแดง: "red",
              赤色: "red",
              สีเขียว: "green",
              緑色: "green",
              สีน้ำเงิน: "blue",
              สีฟ้า: "blue",
              青色: "blue",
            }[token];
            if (color)
              return (
                '<strong class="effect-color color-' +
                color +
                '">' +
                escape(token) +
                "</strong>"
              );
            if (/^[+＋−-]?\d+$/.test(token))
              return (
                '<strong class="effect-number">' + escape(token) + "</strong>"
              );
            return escape(token);
          })
          .join("") +
        "</span>",
    )
    .join("");
}
