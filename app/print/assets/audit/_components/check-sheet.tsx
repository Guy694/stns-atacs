import type { CheckSheet } from "@/lib/annual-check-sheet";
import { checkSheetSigners, money, type CommitteeSigner } from "@/lib/annual-check-sheet";

/**
 * ใบตรวจสอบพัสดุประจำปี — A4 แนวนอน ตามแบบฟอร์มของหน่วยงาน
 * ใช้ CSS ธรรมดาเพื่อให้หน้าพิมพ์คงที่และตรวจสอบได้นอกระบบ
 */
export const CHECK_SHEET_CSS = `
  .chk { color: #000; background: #fff; }
  .chk-head { text-align: center; font-weight: 700; }
  .chk-head h1 { margin: 0; font-size: 14pt; }
  .chk-head p { margin: 2mm 0 0; font-size: 12pt; }
  .chk table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; margin-top: 5mm; }
  .chk th, .chk td { border: 0.3mm solid #0033cc; padding: 1.2mm 1.5mm; vertical-align: middle; word-wrap: break-word; }
  .chk thead th { background: #d9d9d9; text-align: center; font-weight: 700; font-size: 8.5pt; }
  .chk tr.chk-band td { background: #d9d9d9; text-align: center; font-weight: 700; font-size: 10pt; }
  .chk .num { text-align: right; font-variant-numeric: tabular-nums; }
  .chk .mid { text-align: center; }
  .chk tr.total td { font-weight: 700; }
  .chk-sign { margin-top: 10mm; text-align: center; font-size: 11pt; }
  .chk-sign .chair { margin-bottom: 8mm; }
  .chk-sign .members { display: flex; justify-content: space-around; gap: 6mm; }
  .chk-sign p { margin: 0; }
  .chk-sign .name { margin-top: 1.5mm; }
  .chk-note { margin-top: 3mm; font-size: 8pt; color: #444; text-align: right; }
`;

const COLS = ["4%", "8%", "15%", "11%", "22%", "5%", "10%", "9%", "8%", "8%"];

export function CheckSheetView({
  sheet,
  committee,
  printedBy,
  printedAt,
}: {
  sheet: CheckSheet;
  committee: CommitteeSigner[];
  printedBy?: string;
  printedAt?: string;
}) {
  const signers = checkSheetSigners(committee);

  return (
    <section className="chk">
      <div className="chk-head">
        <h1>{sheet.title}</h1>
        <p>หน่วยงาน {sheet.facilityName}</p>
        {sheet.workGroupName ? <p>{sheet.workGroupName}</p> : null}
      </div>

      <table>
        <colgroup>
          {COLS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>ลำดับที่</th>
            <th>วัน เดือน ปี<br />ที่ได้มา</th>
            <th>รหัสครุภัณฑ์</th>
            <th>รหัสสินทรัพย์</th>
            <th>รายการ</th>
            <th>จำนวน<br />หน่วย</th>
            <th>มูลค่าการได้มา</th>
            <th>มูลค่ารวม</th>
            <th>ใช้ประจำที่ไหน</th>
            <th>สถานะพัสดุ</th>
          </tr>
        </thead>
        {sheet.groups.map((group) => (
          <tbody key={group.key}>
            <tr className="chk-band">
              <td colSpan={10}>{group.label}</td>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.assetId}>
                <td className="mid">{row.seq}</td>
                <td className="mid">{row.acquiredOn}</td>
                <td>{row.assetCode}</td>
                <td>{row.accountingCode}</td>
                <td>{row.detail}</td>
                <td className="mid">{row.quantity}</td>
                <td className="num">{row.unitPrice}</td>
                <td className="num">{row.total}</td>
                <td>{row.usedAt}</td>
                <td>{row.status}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={7} className="num">รวม {group.label}</td>
              <td className="num">{money(group.subtotal)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        ))}
        <tbody>
          {sheet.groups.length === 0 ? (
            <tr>
              <td colSpan={10} className="mid" style={{ padding: "10mm" }}>
                ไม่มีรายการครุภัณฑ์ตามเงื่อนไขที่เลือก
              </td>
            </tr>
          ) : null}
          {sheet.groups.length > 1 ? (
            <tr className="total">
              <td colSpan={7} className="num">รวมทั้งสิ้น {sheet.totalCount.toLocaleString("th-TH")} รายการ</td>
              <td className="num">{money(sheet.grandTotal)}</td>
              <td colSpan={2} />
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="chk-sign">
        <div className="chair">
          <p>ลงชื่อ......................................................{signers.chair.label}</p>
          <p className="name">{signers.chair.fullName || "(.....................................................)"}</p>
        </div>
        <div className="members">
          {signers.members.map((member, index) => (
            <div key={index}>
              <p>ลงชื่อ.......................................{member.label}</p>
              <p className="name">{member.fullName || "(...........................................)"}</p>
            </div>
          ))}
        </div>
      </div>

      {printedBy ? (
        <p className="chk-note">
          พิมพ์จากระบบ ATACS โดย {printedBy}
          {printedAt ? ` · ${printedAt}` : ""}
        </p>
      ) : null}
    </section>
  );
}
