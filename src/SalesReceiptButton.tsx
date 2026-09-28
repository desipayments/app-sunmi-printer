import { useState } from "react";
import {
  Printer,
  type PrinterTag,
  type SalesReceiptInfo,
} from "printer-sunmi";

// ============================================================
// SALES DATA BUILDER
// ============================================================

const buildSalesData = (): SalesReceiptInfo => ({
  startDate: new Date(Date.now() - 86400000).toLocaleString(),
  endDate: new Date().toLocaleString(),
  branchId: "BID-002026000025",
  logo: "https://restaurant.onebalancepay.com/logo.png",
  createdAt: new Date().toLocaleString(),
  salesItem: [
    {
      saleBy: "Cash",
      transaction: "42",
      totalSales: "$1250.00",
      refunds: "$50.00",
      manualRefunds: "$0.00",
      collectedAmount: "$1200.00",
    },
    {
      saleBy: "Card",
      transaction: "37",
      totalSales: "$980.50",
      refunds: "$0.00",
      manualRefunds: "$10.00",
      collectedAmount: "$970.50",
    },
    {
      saleBy: "MFS",
      transaction: "51",
      totalSales: "$3120.75",
      refunds: "$120.00",
      manualRefunds: "$0.00",
      collectedAmount: "$3000.75",
    },
  ],
});

// ============================================================
// HELPERS
// ============================================================

type DebugLevel = "info" | "success" | "error" | "warn";

interface DebugEntry {
  id: string;
  time: string;
  level: DebugLevel;
  message: string;
  data?: unknown;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(error);
};

const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error && error.stack) return error.stack;
  return undefined;
};

// ============================================================
// COMPONENT
// ============================================================

export function SalesReceiptButton({
  tag = "RECEIPT",
  disabled,
  onLog,
}: {
  tag?: PrinterTag;
  disabled?: boolean;
  /**
   * Forward every debug line into the host app's logger
   * (e.g. App.tsx's addLog). Optional.
   */
  onLog?: (message: string) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugEntry[]>([]);
  const [lastPayload, setLastPayload] =
    useState<SalesReceiptInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // ----------------------------------------------------------
  // LOG HELPER — writes to BOTH the local panel and the host
  // ----------------------------------------------------------

  const dbg = (
    level: DebugLevel,
    message: string,
    data?: unknown,
  ) => {
    const time = new Date().toLocaleTimeString();

    const entry: DebugEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time,
      level,
      message,
      data,
    };

    setDebugLogs((prev) => [entry, ...prev].slice(0, 200));

    // Forward into host app log (App.tsx → Logs tab)
    if (onLog) {
      const prefix =
        level === "success"
          ? "✅"
          : level === "error"
            ? "❌"
            : level === "warn"
              ? "⚠️"
              : "ℹ️";

      onLog(`${prefix} [SALES] ${message}`);

      if (data !== undefined) {
        const pretty =
          typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2);

        // Split multi-line JSON so each line shows separately
        for (const line of pretty.split("\n")) {
          onLog(`   ${line}`);
        }
      }
    }
  };

  // ----------------------------------------------------------
  // PRINT HANDLER
  // ----------------------------------------------------------

  const handlePrint = async () => {
    const startedAt = performance.now();

    setLastError(null);
    setLastDuration(null);

    dbg("info", `Starting sales receipt print (tag=${tag})`);

    // ---- Validate ready state ----
    try {
      const status = await Printer.getPrinterStatus();
      dbg("info", "Printer status snapshot", status);

      if (!status.connected) {
        throw new Error("Printer service is not connected");
      }
      if (!status.ready) {
        throw new Error("Printer is not ready");
      }
    } catch (statusErr) {
      const msg = getErrorMessage(statusErr);
      dbg("error", `Pre-flight check failed: ${msg}`, statusErr);
      setLastError(msg);
      setErrorCount((n) => n + 1);
      return;
    }

    // ---- Check assignment for the tag ----
    try {
      const assignments = await Printer.getPrinterAssignments();
      const assignment = assignments[tag];
      dbg("info", `Assignment for ${tag}`, assignment);

      if (!assignment) {
        throw new Error(`No printer assigned for tag "${tag}"`);
      }
    } catch (assignErr) {
      const msg = getErrorMessage(assignErr);
      dbg("error", `Assignment check failed: ${msg}`, assignErr);
      setLastError(msg);
      setErrorCount((n) => n + 1);
      return;
    }

    // ---- Build payload ----
    const salesInfo = buildSalesData();
    setLastPayload(salesInfo);

    dbg("info", "Built sales payload", {
      startDate: salesInfo.startDate,
      endDate: salesInfo.endDate,
      branchId: salesInfo.branchId,
      itemCount: salesInfo.salesItem?.length ?? 0,
    });

    dbg(
      "info",
      "Full payload JSON",
      JSON.stringify(salesInfo, null, 2),
    );

    // ---- Print ----
    try {
      setPrinting(true);

      const args = { tag, salesInfo };
      dbg("info", "Calling Printer.printReceipt()", args);

      await Printer.print(args as any);

      const elapsed = Math.round(performance.now() - startedAt);
      setLastDuration(elapsed);
      setSuccessCount((n) => n + 1);

      dbg("success", `Printed successfully in ${elapsed}ms`);

      // ---- Post-print status ----
      try {
        const post = await Printer.getPrinterStatus();
        dbg("info", "Post-print status", post);
      } catch {
        /* ignore */
      }
    } catch (printErr) {
      const msg = getErrorMessage(printErr);
      const stack = getErrorStack(printErr);
      const elapsed = Math.round(performance.now() - startedAt);

      setLastError(msg);
      setLastDuration(elapsed);
      setErrorCount((n) => n + 1);

      dbg("error", `Print failed after ${elapsed}ms: ${msg}`, {
        message: msg,
        stack,
        raw: printErr,
      });

      // Dump raw error safely
      try {
        dbg(
          "error",
          "Raw error (JSON)",
          JSON.stringify(
            printErr,
            Object.getOwnPropertyNames(printErr as object),
            2,
          ),
        );
      } catch {
        dbg("error", "Raw error (string)", String(printErr));
      }
    } finally {
      setPrinting(false);
      dbg("info", "Print cycle finished");
    }
  };

  // ----------------------------------------------------------
  // STYLES
  // ----------------------------------------------------------

  const btnStyle: React.CSSProperties = {
    padding: "10px 18px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    background:
      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    color: "#ffffff",
    opacity: disabled || printing ? 0.6 : 1,
  };

  const dbgBtnStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    background: showDebug
      ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
      : "rgba(255,255,255,0.12)",
    color: "#ffffff",
  };

  const panelStyle: React.CSSProperties = {
    marginTop: "12px",
    padding: "16px",
    borderRadius: "14px",
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e0e0e0",
    fontFamily: "'Fira Code', 'Courier New', monospace",
    fontSize: "12px",
  };

  const statBox: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    textAlign: "center",
    minWidth: "90px",
  };

  const levelColor: Record<DebugLevel, string> = {
    info: "#64b5f6",
    success: "#81c784",
    error: "#ef5350",
    warn: "#ffb74d",
  };

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <div style={{ display: "inline-block" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handlePrint}
          disabled={disabled || printing}
          style={btnStyle}
        >
          {printing ? "⏳ Printing Sales..." : "📈 Print Sales Receipt"}
        </button>

        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          style={dbgBtnStyle}
        >
          {showDebug ? "🐞 Hide Debug" : "🐞 Debug"}
        </button>
      </div>

      {showDebug && (
        <div style={panelStyle}>
          {/* SUMMARY STATS */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            <div style={statBox}>
              <div style={{ color: "#aaa", fontSize: "10px" }}>TAG</div>
              <div style={{ fontWeight: 700 }}>{tag}</div>
            </div>

            <div style={statBox}>
              <div style={{ color: "#aaa", fontSize: "10px" }}>
                SUCCESS
              </div>
              <div style={{ fontWeight: 700, color: "#81c784" }}>
                {successCount}
              </div>
            </div>

            <div style={statBox}>
              <div style={{ color: "#aaa", fontSize: "10px" }}>
                ERRORS
              </div>
              <div style={{ fontWeight: 700, color: "#ef5350" }}>
                {errorCount}
              </div>
            </div>

            <div style={statBox}>
              <div style={{ color: "#aaa", fontSize: "10px" }}>
                LAST DURATION
              </div>
              <div style={{ fontWeight: 700 }}>
                {lastDuration !== null ? `${lastDuration}ms` : "—"}
              </div>
            </div>

            <div style={statBox}>
              <div style={{ color: "#aaa", fontSize: "10px" }}>ITEMS</div>
              <div style={{ fontWeight: 700 }}>
                {lastPayload?.salesItem?.length ?? "—"}
              </div>
            </div>
          </div>

          {/* LAST ERROR */}
          {lastError && (
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                background: "rgba(239,83,80,0.15)",
                border: "1px solid rgba(239,83,80,0.4)",
                color: "#ef9a9a",
                marginBottom: "12px",
              }}
            >
              <strong>Last error:</strong> {lastError}
            </div>
          )}

          {/* LAST PAYLOAD */}
          {lastPayload && (
            <details
              style={{
                marginBottom: "12px",
                background: "rgba(255,255,255,0.04)",
                padding: "10px",
                borderRadius: "8px",
              }}
            >
              <summary style={{ cursor: "pointer", color: "#90caf9" }}>
                📦 Last payload
              </summary>
              <pre
                style={{
                  margin: "8px 0 0 0",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#b0bec5",
                }}
              >
                {JSON.stringify(lastPayload, null, 2)}
              </pre>
            </details>
          )}

          {/* LIVE LOG */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <strong style={{ color: "#fff" }}>
              📋 Debug Log ({debugLogs.length})
            </strong>

            <button
              type="button"
              onClick={() => {
                setDebugLogs([]);
                setLastError(null);
                setLastDuration(null);
                setSuccessCount(0);
                setErrorCount(0);
                setLastPayload(null);
              }}
              style={{
                ...dbgBtnStyle,
                padding: "4px 10px",
                fontSize: "11px",
                background: "rgba(255,255,255,0.1)",
              }}
            >
              Clear
            </button>
          </div>

          <div
            style={{
              maxHeight: "260px",
              overflowY: "auto",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "8px",
              padding: "10px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {debugLogs.length === 0 ? (
              <div style={{ color: "#666", textAlign: "center" }}>
                No logs yet. Click "Print Sales Receipt" to start.
              </div>
            ) : (
              debugLogs.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    marginBottom: "6px",
                    paddingBottom: "6px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div>
                    <span style={{ color: "#666" }}>
                      [{entry.time}]
                    </span>{" "}
                    <span
                      style={{
                        color: levelColor[entry.level],
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {entry.level}
                    </span>{" "}
                    <span>{entry.message}</span>
                  </div>

                  {entry.data !== undefined && (
                    <pre
                      style={{
                        margin: "4px 0 0 0",
                        padding: "6px",
                        background: "rgba(0,0,0,0.4)",
                        borderRadius: "6px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#90a4ae",
                        fontSize: "11px",
                      }}
                    >
                      {typeof entry.data === "string"
                        ? entry.data
                        : JSON.stringify(entry.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}