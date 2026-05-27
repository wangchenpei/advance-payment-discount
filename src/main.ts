/**
 * 名义总保费 total，分 n 年等额缴，每期 P = total/n。
 * 第 0 时刻从实缴 X 扣 P；之后前 (n−2) 个计息年度：每年先按 r[k] 滚存一年再扣 P；
 * 最后一个计息年度：仅按 r[n−2] 滚存一年，使期末余额**恰为** P（用于最后一期，不再从账户扣减 P）。
 * 共 n−1 个利率。由此从末态倒推 X。
 */
export function solveLumpSum(total: number, n: number, rates: number[]): number {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("名义保费须为非负有限数");
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("年数须为不小于 1 的整数");
  }

  const P = total / n;
  if (n === 1) {
    if (rates.length > 0) {
      throw new Error("分 1 年交时不应再填写计息利率（无计息期）");
    }
    return total;
  }

  if (rates.length !== n - 1) {
    throw new Error(
      `分期年数为 ${n} 时，需要恰好 ${n - 1} 个年利率，当前为 ${rates.length} 个`,
    );
  }

  for (let i = 0; i < rates.length; i++) {
    const r = rates[i];
    if (!Number.isFinite(r) || r <= -1) {
      throw new Error(`第 ${i + 1} 个利率须为大于 -1 的有限数（当前为 ${r}）`);
    }
  }

  // 末态：B_{n-2}·(1+r_{n-1}) = P（最后一期只由滚存结果覆盖，不再执行「先息后扣 P」）
  let B = P / (1 + rates[rates.length - 1]);
  for (let k = rates.length - 2; k >= 0; k--) {
    const r = rates[k];
    B = (B + P) / (1 + r);
  }
  return B + P;
}

/** 正向验算：各节点账户余额（与 solveLumpSum 末态约定一致） */
export function forwardLedger(
  X: number,
  P: number,
  rates: number[],
): { label: string; balance: number }[] {
  const rows: { label: string; balance: number }[] = [];
  let B = X - P;
  rows.push({ label: "第 0 期扣款后账户余额", balance: B });

  if (rates.length === 0) return rows;

  for (let i = 0; i < rates.length - 1; i++) {
    const r = rates[i];
    B = B * (1 + r) - P;
    rows.push({
      label: `第 ${i + 1} 年末（先按 ${(r * 100).toLocaleString("zh-CN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      })}% 计息再扣一期）`,
      balance: B,
    });
  }
  const rLast = rates[rates.length - 1];
  const finalBal = B * (1 + rLast);
  rows.push({
    label: `第 ${rates.length} 年末（先按 ${(rLast * 100).toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })}% 计息；余额恰为最后一期保费，不再扣减）`,
    balance: finalBal,
  });
  return rows;
}

function formatYuanInteger(n: number): string {
  return (
    Math.round(n).toLocaleString("zh-CN", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }) + " 元"
  );
}

const el = (id: string) => document.getElementById(id)!;

/** 名义保费：仅保留数字，千位逗号展示（整数元） */
function parseDigitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatIntegerCommas(digits: string): string {
  if (!digits) return "";
  const noLeadingZeros = digits.replace(/^0+(?=\d)/u, "");
  const core = noLeadingZeros || "0";
  return core.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

function digitsBeforeCaret(formatted: string, caret: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(caret, formatted.length); i++) {
    if (/\d/u.test(formatted[i])) n++;
  }
  return n;
}

function caretAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let n = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/u.test(formatted[i])) {
      n++;
      if (n === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function parseNominalInput(value: string): number {
  const digits = parseDigitsOnly(value);
  if (!digits) return NaN;
  return Number(digits);
}

function formatPercentDisplay(r: number): string {
  const p = r * 100;
  const s = p.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
  return `${s}%`;
}

function formatRatesSummary(rates: number[]): string {
  if (rates.length === 0) return "（尚未填写利率）";
  return rates.map((r, i) => `第 ${i + 1} 年 ${formatPercentDisplay(r)}`).join(" · ");
}

/** 将已保存的利率条数截断到当前年数所需长度，不自动补默认利率 */
function trimRatesToNeed(years: number, prev: number[]): number[] {
  const need = Math.max(0, years - 1);
  return prev.slice(0, need);
}

let ratesDecimal: number[] = [];

function parseYearsFromInput(): number {
  const raw = (el("years") as HTMLInputElement).value.trim();
  if (raw === "") return NaN;
  const y = Math.round(Number(raw));
  if (!Number.isFinite(y) || y < 1 || !Number.isInteger(y)) return NaN;
  return y;
}

function syncRatesUi(): void {
  const years = parseYearsFromInput();
  const summary = el("ratesSummary") as HTMLElement;
  const openBtn = el("openRatesModal") as HTMLButtonElement;
  const hint = el("ratesCountHint") as HTMLElement;

  if (!Number.isFinite(years)) {
    ratesDecimal = [];
    hint.textContent = "—";
    summary.textContent = "请先填写原始分期年数（正整数）。";
    openBtn.disabled = true;
    return;
  }

  ratesDecimal = trimRatesToNeed(years, ratesDecimal);
  const need = Math.max(0, years - 1);
  hint.textContent = String(need);

  if (years <= 1) {
    summary.textContent = "分 1 年交：无中间计息期，无需填写利率。";
    openBtn.disabled = true;
    return;
  }

  openBtn.disabled = false;
  if (ratesDecimal.length < need) {
    summary.textContent = `请在弹窗中填写全部 ${need} 个计息年度利率（当前已填 ${ratesDecimal.length} 个）。`;
  } else {
    summary.textContent = formatRatesSummary(ratesDecimal);
  }
}

function buildRatesDialogFields(): void {
  const years = parseYearsFromInput();
  if (!Number.isFinite(years)) {
    throw new Error("请先填写原始分期年数（正整数）。");
  }
  const need = Math.max(0, years - 1);
  const container = el("ratesDialogFields") as HTMLElement;
  container.innerHTML = "";

  (el("ratesDialogHint") as HTMLElement).textContent =
    need === 0
      ? "当前年数为 1，无计息期。"
      : `分期年数为 ${years}：请填写第 1 至第 ${need} 个计息年度的年化利率（数字即可，单位为 %）。`;

  for (let i = 0; i < need; i++) {
    const wrap = document.createElement("div");
    wrap.className = "rateField";
    const label = document.createElement("label");
    label.htmlFor = `ratePct_${i}`;
    label.textContent = `第 ${i + 1} 计息年度利率（%）`;
    const input = document.createElement("input");
    input.id = `ratePct_${i}`;
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    const r = ratesDecimal[i] ?? 0;
    input.value = Number.isFinite(r) ? String(r * 100) : "";
    wrap.append(label, input);
    container.appendChild(wrap);
  }
}

function readRatesFromDialog(): number[] {
  const years = parseYearsFromInput();
  if (!Number.isFinite(years)) {
    throw new Error("请先填写原始分期年数（正整数）。");
  }
  const need = Math.max(0, years - 1);
  const out: number[] = [];
  for (let i = 0; i < need; i++) {
    const input = document.getElementById(`ratePct_${i}`) as HTMLInputElement | null;
    const raw = (input?.value ?? "").trim().replace(/%/u, "");
    if (!raw) {
      throw new Error(`请填写第 ${i + 1} 计息年度的利率（%）`);
    }
    const pct = Number(raw);
    if (!Number.isFinite(pct) || pct <= -100) {
      throw new Error(`第 ${i + 1} 个利率无效：${input?.value ?? ""}`);
    }
    out.push(pct / 100);
  }
  return out;
}

function formatLedgerInteger(n: number): string {
  return Math.round(n).toLocaleString("zh-CN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

function run(): void {
  const err = el("error") as HTMLElement;
  const res = el("result") as HTMLElement;
  err.hidden = true;
  res.hidden = true;
  err.textContent = "";

  try {
    const nominal = parseNominalInput((el("nominal") as HTMLInputElement).value);
    if (!Number.isFinite(nominal)) {
      throw new Error("请填写总名义保费（元），仅输入数字即可");
    }
    const years = parseYearsFromInput();
    if (!Number.isFinite(years)) {
      throw new Error("请填写原始分期年数（正整数）");
    }
    const rates = ratesDecimal;
    if (years >= 2 && rates.length !== years - 1) {
      throw new Error(
        `分期年数为 ${years} 时，请在弹窗中填写全部 ${years - 1} 个年利率（当前已填 ${rates.length} 个）。`,
      );
    }

    const X = solveLumpSum(nominal, years, rates);
    const P = nominal / years;
    const save = nominal - X;
    const ledger = forwardLedger(X, P, rates);

    (el("outLump") as HTMLElement).textContent = formatYuanInteger(X);
    (el("outSave") as HTMLElement).textContent = formatYuanInteger(save);

    const prepayBonusEl = el("outPrepayBonus") as HTMLElement;
    if (nominal <= 0 || !Number.isFinite(years) || years < 1) {
      prepayBonusEl.textContent = "—";
    } else {
      const ratioPct = (save / nominal) * years * 100;
      prepayBonusEl.textContent = `${Math.round(ratioPct).toLocaleString("zh-CN", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      })}%`;
    }

    const warn = el("outWarn") as HTMLElement;
    if (save < 0) {
      warn.hidden = false;
      warn.textContent =
        "提示：在当前利率与约束下，倒推出的实缴一次性金额高于名义总保费。通常出现在各年利率过低或为 0 的情形；请核对利率与业务含义是否与您的合同一致。";
    } else {
      warn.hidden = true;
      warn.textContent = "";
    }

    const lines = ledger.map(
      (r) => `${r.label}：${formatLedgerInteger(r.balance)}`,
    );
    (el("outSteps") as HTMLElement).textContent = lines.join("\n");

    res.hidden = false;
  } catch (e) {
    err.textContent = e instanceof Error ? e.message : String(e);
    err.hidden = false;
  }
}

function wireNominalThousands(): void {
  const nominalInput = el("nominal") as HTMLInputElement;
  nominalInput.addEventListener("input", () => {
    const caret = nominalInput.selectionStart ?? nominalInput.value.length;
    const digitCount = digitsBeforeCaret(nominalInput.value, caret);
    const raw = parseDigitsOnly(nominalInput.value);
    const formatted = formatIntegerCommas(raw);
    nominalInput.value = formatted;
    const newCaret = caretAfterDigits(formatted, digitCount);
    requestAnimationFrame(() => {
      nominalInput.setSelectionRange(newCaret, newCaret);
    });
  });
}

function wireRatesDialog(): void {
  const dialog = el("ratesDialog") as HTMLDialogElement;
  (el("openRatesModal") as HTMLButtonElement).addEventListener("click", () => {
    syncRatesUi();
    try {
      buildRatesDialogFields();
      if (!dialog.open) dialog.showModal();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  });

  (el("ratesDialogCancel") as HTMLButtonElement).addEventListener("click", () => {
    dialog.close();
  });

  (el("ratesDialogOk") as HTMLButtonElement).addEventListener("click", () => {
    try {
      ratesDecimal = readRatesFromDialog();
      (el("ratesSummary") as HTMLElement).textContent = formatRatesSummary(ratesDecimal);
      dialog.close();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  });

  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) dialog.close();
  });
}

const onYearsChanged = (): void => {
  syncRatesUi();
};
(el("years") as HTMLInputElement).addEventListener("change", onYearsChanged);
(el("years") as HTMLInputElement).addEventListener("input", onYearsChanged);

(el("calc") as HTMLButtonElement).addEventListener("click", run);

wireNominalThousands();
wireRatesDialog();
syncRatesUi();
