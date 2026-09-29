import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SalesReceiptButton } from "./SalesReceiptButton";

import {
  Printer,
  type GetPrintersResult,
  type OrderReceiptInfo,
  type OrderReceiptItem,
  type PrinterAssignmentsResult,
  type PrinterInfo,
  type PrinterTag,
} from "printer-sunmi";

// ============================================================
// APP COMPONENT
// ============================================================

function App() {
  // ============================================================
  // STATE
  // ============================================================

  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>("Checking...");

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);

  const [assignments, setAssignments] =
    useState<PrinterAssignmentsResult>({});

  const [isLoadingPrinters, setIsLoadingPrinters] =
    useState(false);

  const [isAssigning, setIsAssigning] =
    useState(false);

  const [printingTag, setPrintingTag] =
    useState<PrinterTag | null>(null);

  const [printCount, setPrintCount] = useState(0);

  const [error, setError] = useState("");

  const [logs, setLogs] = useState<string[]>([]);

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [viewMode, setViewMode] = useState<
    "dashboard" | "printers" | "logs"
  >("dashboard");

  const [orderType, setOrderType] = useState<
    "takeaway" | "table"
  >("table");

  const [receiptType, setReceiptType] = useState<
    "sale" | "refund" | "void"
  >("sale");

  const logContainerRef =
    useRef<HTMLDivElement>(null);

  // ============================================================
  // HELPERS
  // ============================================================

  const addLog = (message: string) => {
    const timestamp =
      new Date().toLocaleTimeString();

    setLogs((previous) =>
      [
        `[${timestamp}] ${message}`,
        ...previous,
      ].slice(0, 100),
    );
  };

  const showNotification = (
    message: string,
    type:
      | "success"
      | "error"
      | "info" = "info",
  ) => {
    setNotification({
      message,
      type,
    });

    window.setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const getErrorMessage = (
    error: unknown,
  ): string => {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      const message = (
        error as {
          message?: unknown;
        }
      ).message;

      if (typeof message === "string") {
        return message;
      }
    }

    return String(error);
  };

  const getAssignmentForPrinter = (
    printerId: string,
  ) => {
    const isReceipt =
      assignments.RECEIPT?.printerId ===
      printerId;

    const isKitchen =
      assignments.KITCHEN?.printerId ===
      printerId;

    return {
      isReceipt,
      isKitchen,
    };
  };

  const getTagLabel = (
    tag: PrinterTag,
  ) => {
    return tag === "RECEIPT"
      ? "Receipt"
      : "Kitchen";
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    const platform =
      Capacitor.getPlatform();

    addLog(`Platform: ${platform}`);

    void initializePrinter();

    return () => {
      void Printer.destroy().catch(
        () => {},
      );
    };
  }, []);

  // ============================================================
  // LOAD PRINTER DATA
  // ============================================================

  const loadPrinters = async () => {
    try {
      setIsLoadingPrinters(true);

      const result: GetPrintersResult =
        await Printer.getPrinters();

      const assignmentResult =
        await Printer.getPrinterAssignments();

      setPrinters(
        result.printers ?? [],
      );

      setAssignments(
        assignmentResult,
      );

      addLog(
        `🖨️ Printers discovered: ${result.count}`,
      );

      if (assignmentResult.RECEIPT) {
        addLog(
          `🧾 RECEIPT assigned: ${
            assignmentResult.RECEIPT
              .printerName ??
            "Unknown"
          }`,
        );
      }

      if (assignmentResult.KITCHEN) {
        addLog(
          `🍳 KITCHEN assigned: ${
            assignmentResult.KITCHEN
              .printerName ??
            "Unknown"
          }`,
        );
      }
    } catch (error) {
      const message =
        getErrorMessage(error);

      addLog(
        `❌ Failed to load printers: ${message}`,
      );

      showNotification(
        "Failed to load printers",
        "error",
      );
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  // ============================================================
  // INITIALIZE PRINTER
  // ============================================================

  const initializePrinter =
    async () => {
      try {
        setError("");
        setStatus("Connecting...");

        addLog(
          "🔧 Initializing printer service...",
        );

        const result =
          await Printer.initPrinter();

        setConnected(
          result.connected,
        );

        setReady(result.ready);

        setStatus(
          result.status ?? "Unknown",
        );

        addLog(
          `✅ Init: connected=${result.connected}, ready=${result.ready}`,
        );

        if (result.message) {
          addLog(
            `   ${result.message}`,
          );
        }

        if (!result.connected) {
          setError(
            "SUNMI printer service is not connected",
          );

          showNotification(
            "Printer service not connected",
            "error",
          );
        } else if (!result.ready) {
          setError(
            "Printer is connected but not ready",
          );

          showNotification(
            "Printer is not ready",
            "error",
          );
        } else {
          showNotification(
            "Printer service ready",
            "success",
          );
        }

        await loadPrinters();
      } catch (error) {
        const message =
          getErrorMessage(error);

        console.error(
          "SUNMI printer initialization failed:",
          error,
        );

        addLog(
          `❌ Init error: ${message}`,
        );

        setConnected(false);
        setReady(false);
        setStatus("disconnected");

        setError(
          "Failed to initialize SUNMI printer service",
        );

        showNotification(
          "Printer initialization failed",
          "error",
        );
      }
    };

  // ============================================================
  // CHECK STATUS
  // ============================================================

  const checkStatus = async () => {
    try {
      addLog(
        "📊 Checking printer status...",
      );

      const result =
        await Printer.getPrinterStatus();

      setConnected(
        result.connected,
      );

      setReady(result.ready);

      setStatus(result.status);

      addLog(
        `📊 Status: connected=${result.connected}, ready=${result.ready}`,
      );

      addLog(
        `   Status: ${result.status}`,
      );

      if (result.printerName) {
        addLog(
          `   Printer: ${result.printerName}`,
        );
      }

      if (result.printerId) {
        addLog(
          `   ID: ${result.printerId}`,
        );
      }

      if (!result.ready) {
        setError(
          "Printer is not ready",
        );

        showNotification(
          "Printer is not ready",
          "error",
        );
      } else {
        setError("");

        showNotification(
          "Printer is ready",
          "success",
        );
      }

      await loadPrinters();
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        "Failed to get printer status:",
        error,
      );

      addLog(
        `❌ Status error: ${message}`,
      );

      setError(
        "Failed to get printer status",
      );

      showNotification(
        "Status check failed",
        "error",
      );
    }
  };

  // ============================================================
  // GENERATE ORDER DATA
  // ============================================================a

  const generateOrderData = (
    type: "takeaway" | "table",
  ): OrderReceiptInfo => {
    const items: OrderReceiptItem[] = [
      {
        name: "Classic Burger",
        quantity: "2",
        rate: "$12.99",
        total: "$25.98",
        specialInstruction: "No onions\nExtra crispy",
      },
      {
        name: "Extra Cheese",
        quantity: "1",
        rate: "$1.50",
        total: "$1.50",
        isModifier: true,
      },
      {
        name: "Cheese Pizza",
        quantity: "1",
        rate: "$14.99",
        total: "$14.99",
      },
      {
        name: "French Fries",
        quantity: "3",
        rate: "$4.99",
        total: "$14.97",
        specialInstruction: "Less salt",
      },
      {
        name: "Soft Drink",
        quantity: "2",
        rate: "$2.99",
        total: "$5.98",
      },
    ];

    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.total.replace("$", "")),
      0,
    );

    const taxAmount = subtotal * 0.1;
    const feesAmount = 0;
    const gratuityAmount =
      type === "table" ? subtotal * 0.1 : 0;
    const discountAmount = subtotal * 0.05;
    const tipsAmount = 0;

    const total =
      subtotal +
      taxAmount +
      feesAmount +
      gratuityAmount -
      discountAmount +
      tipsAmount;

    const isSale = receiptType === "sale";
    const isRefund = receiptType === "refund";
    const isVoid = receiptType === "void";

    return {
      restaurantName: "OneBalance Restaurant",
      address: "8966 211th Street, Queens, NY 11427",
      phone: "+1 (929) 386-9131",
      email: "sales@onebalancepay.com",
      logo: "https://restaurant.onebalancepay.com/logo.png",

      reciptType: receiptType.toUpperCase(),
      reciptTypeId: isRefund
        ? `REF-${Date.now()}`
        : isVoid
          ? `VOID-${Date.now()}`
          : "",

      orderNumber:
        type === "table"
          ? `TBL-${Date.now()}`
          : `TAK-${Date.now()}`,

      createdAt: new Date().toLocaleString(),

      salesType:
        type === "table"
          ? "Table: 05"
          : "Takeaway",

      server:
        type === "table"
          ? "John Doe"
          : "Counter",

      priority:
        type === "table"
          ? "high"
          : "normal",

      orderNotes:
        "Please prepare quickly. Serve hot.",

      paymentMethod: "Card",

      subtotal: `$${subtotal.toFixed(2)}`,
      total: `$${total.toFixed(2)}`,

      tax: {
        label: "Tax (10%):",
        amount: `$${taxAmount.toFixed(2)}`,
      },

      fees: {
        label: "Fees:",
        amount: `$${feesAmount.toFixed(2)}`,
      },

      gratuity: {
        label: "Gratuity Fees:",
        amount: `$${gratuityAmount.toFixed(2)}`,
      },

      discount: {
        label: "Discount (5%):",
        amount: `-$${discountAmount.toFixed(2)}`,
      },

      tips: {
        label: "Tips:",
        amount: `$${tipsAmount.toFixed(2)}`,
      },

      items,

      // Card payment fields
      cardNumber: "•••• •••• •••• 1234",
      cardType: "Visa",
      authCode: "AUTH123456",
      transactionId: `TXN-${Date.now()}`,
      paidAmount: `$${total.toFixed(2)}`,

      // Cash fields are also supplied so the payload supports the
      // native receipt implementation when the payment method changes.
      tenderedAmount: `$${Math.ceil(total / 10) * 10}`,
      changeAmount: `$${(
        Math.ceil(total / 10) * 10 -
        total
      ).toFixed(2)}`,

      // Refund
      refundAmount: isRefund
        ? `$${total.toFixed(2)}`
        : "",
      refundMethod: isRefund
        ? "Original Card"
        : "",

      // Void
      voidAmount: isVoid
        ? `$${total.toFixed(2)}`
        : "",
      voidTime: isVoid
        ? new Date().toLocaleString()
        : "",

      // Refund / Void operation information
      operationReason: isRefund
        ? "Customer requested refund"
        : isVoid
          ? "Order cancelled by customer"
          : "",

      operationBy:
        isRefund || isVoid
          ? "John Doe"
          : "",

      transactionStatus: isSale
        ? "PAID"
        : isRefund
          ? "REFUNDED"
          : "VOIDED",

      showTipSuggestions:
        isSale && type === "table",

      tip5Tip:
        `$${(total * 0.05).toFixed(2)}`,
      tip5Total:
        `$${(total * 1.05).toFixed(2)}`,

      tip10Tip:
        `$${(total * 0.10).toFixed(2)}`,
      tip10Total:
        `$${(total * 1.10).toFixed(2)}`,

      tip15Tip:
        `$${(total * 0.15).toFixed(2)}`,
      tip15Total:
        `$${(total * 1.15).toFixed(2)}`,

      tip20Tip:
        `$${(total * 0.20).toFixed(2)}`,
      tip20Total:
        `$${(total * 1.20).toFixed(2)}`,

      footerMessage:
        type === "table"
          ? "Thank you for dining with us!\nWe hope you enjoyed your meal."
          : "Thank you for your takeaway order!\nWe hope to see you again!",
    };
  };

  // ============================================================
  // PRINT TEST
  // ============================================================

  const printTest = async (
    tag: PrinterTag,
  ) => {
    if (!ready) {
      showNotification(
        "Printer is not ready",
        "error",
      );
      return;
    }

    const assignment =
      assignments[tag];

    if (!assignment) {
      showNotification(
        `${getTagLabel(tag)} printer is not assigned`,
        "error",
      );
      return;
    }

    try {
      setPrintingTag(tag);
      setError("");

      addLog(
        `🖨️ Printing ${tag} test receipt...`,
      );

      await Printer.printTestReceipt({
        tag,
      });

      setPrintCount(
        (previous) =>
          previous + 1,
      );

      addLog(
        `✅ ${tag} test receipt printed`,
      );

      showNotification(
        `${getTagLabel(tag)} test receipt printed`,
        "success",
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        `${tag} test print failed:`,
        error,
      );

      addLog(
        `❌ ${tag} test print error: ${message}`,
      );

      setError(
        `${getTagLabel(tag)} test print failed`,
      );

      showNotification(
        "Test print failed",
        "error",
      );
    } finally {
      setPrintingTag(null);
    }
  };

  // ============================================================
  // PRINT RECEIPT / KITCHEN
  // ============================================================

  const printReceipt = async (
    tag: PrinterTag,
  ) => {
    if (!ready) {
      showNotification(
        "Printer is not ready",
        "error",
      );
      return;
    }

    const assignment =
      assignments[tag];

    if (!assignment) {
      showNotification(
        `${getTagLabel(tag)} printer is not assigned`,
        "error",
      );
      return;
    }

    try {
      setPrintingTag(tag);
      setError("");

      const orderInfo =
        generateOrderData(orderType);

      addLog(
        `🧾 Printing ${receiptType.toUpperCase()} ${tag}...`,
      );

      addLog(
        `   Printer: ${
          assignment.printerName ??
          "Unknown"
        }`,
      );

      addLog(
        `   Printer ID: ${assignment.printerId}`,
      );

      addLog(
        `   Order: ${orderInfo.orderNumber ?? "N/A"}`,
      );

      addLog(
        `   Items: ${orderInfo.items?.length}`,
      );

      addLog(
        `   Total: ${orderInfo.total}`,
      );

      await Printer.print({
        tag,
        orderInfo,
      });

      setPrintCount(
        (previous) =>
          previous + 1,
      );

      addLog(
        `✅ ${tag} printed successfully`,
      );

      showNotification(
        `${getTagLabel(tag)} printed successfully`,
        "success",
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        `${tag} print failed:`,
        error,
      );

      addLog(
        `❌ ${tag} print error: ${message}`,
      );

      setError(
        `${getTagLabel(tag)} print failed`,
      );

      showNotification(
        message ||
          "Print failed",
        "error",
      );
    } finally {
      setPrintingTag(null);
    }
  };

  // ============================================================
  // ASSIGN PRINTER
  // ============================================================

  const assignPrinter = async (
    tag: PrinterTag,
    printer: PrinterInfo,
  ) => {
    try {
      setIsAssigning(true);
      setError("");

      addLog(
        `🔗 Assigning ${printer.name} to ${tag}...`,
      );

      await Printer.setPrinterForTag({
        tag,
        printerIndex: printer.index,
      });

      const updatedAssignments =
        await Printer.getPrinterAssignments();

      setAssignments(
        updatedAssignments,
      );

      const updatedPrinters =
        await Printer.getPrinters();

      setPrinters(
        updatedPrinters.printers,
      );

      addLog(
        `✅ ${tag} assigned to ${printer.name}`,
      );

      showNotification(
        `${printer.name} assigned as ${getTagLabel(tag)}`,
        "success",
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        "Printer assignment failed:",
        error,
      );

      addLog(
        `❌ Assignment failed: ${message}`,
      );

      setError(
        `Failed to assign ${getTagLabel(tag)} printer`,
      );

      showNotification(
        message ||
          "Failed to assign printer",
        "error",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  // ============================================================
  // REMOVE ASSIGNMENT
  // ============================================================

  const removeAssignment = async (
    tag: PrinterTag,
  ) => {
    try {
      setIsAssigning(true);
      setError("");

      addLog(
        `🔓 Removing ${tag} printer assignment...`,
      );

      await Printer.removePrinterForTag({
        tag,
      });

      const updatedAssignments =
        await Printer.getPrinterAssignments();

      setAssignments(
        updatedAssignments,
      );

      const updatedPrinters =
        await Printer.getPrinters();

      setPrinters(
        updatedPrinters.printers,
      );

      addLog(
        `✅ ${tag} printer assignment removed`,
      );

      showNotification(
        `${getTagLabel(tag)} assignment removed`,
        "success",
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.error(
        "Remove assignment failed:",
        error,
      );

      addLog(
        `❌ Remove assignment error: ${message}`,
      );

      setError(
        `Failed to remove ${getTagLabel(tag)} assignment`,
      );

      showNotification(
        message ||
          "Failed to remove assignment",
        "error",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  // ============================================================
  // DESTROY
  // ============================================================

  const destroyPrinter = async () => {
    try {
      addLog(
        "🔌 Destroying printer service...",
      );

      await Printer.destroy();

      setConnected(false);
      setReady(false);
      setStatus("destroyed");

      addLog(
        "✅ Printer service destroyed",
      );

      showNotification(
        "Printer service destroyed",
        "info",
      );
    } catch (error) {
      const message =
        getErrorMessage(error);

      addLog(
        `❌ Destroy error: ${message}`,
      );

      showNotification(
        "Destroy failed",
        "error",
      );
    }
  };

  // ============================================================
  // AUTO SCROLL LOGS
  // ============================================================

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  // ============================================================
  // STYLES
  // ============================================================

  const styles = {
    container: {
      minHeight: "100vh",
      background:
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      padding: "20px",
      color: "#ffffff",
    },

    header: {
      color: "#ffffff",
      marginBottom: "24px",
      paddingBottom: "16px",
      borderBottom:
        "2px solid rgba(255,255,255,0.2)",
    },

    card: {
      background:
        "rgba(255, 255, 255, 0.12)",
      backdropFilter:
        "blur(10px)",
      padding: "24px",
      borderRadius: "16px",
      marginBottom: "16px",
      border:
        "1px solid rgba(255,255,255,0.18)",
      boxShadow:
        "0 8px 32px rgba(0,0,0,0.15)",
    },

    button: {
      padding: "10px 18px",
      borderRadius: "12px",
      border:
        "1px solid rgba(255,255,255,0.2)",
      cursor: "pointer",
      fontWeight:
        "600",
      fontSize: "14px",
      transition:
        "all 0.3s ease",
      background:
        "rgba(255,255,255,0.15)",
      color: "#ffffff",
      backdropFilter:
        "blur(5px)",
    },

    primaryButton: {
      background:
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      color: "#ffffff",
      border: "none",
    },

    dangerButton: {
      background:
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      color: "#ffffff",
      border: "none",
    },

    statusBadge: {
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight:
        "600",
      display:
        "inline-block",
      backdropFilter:
        "blur(5px)",
    },

    statCard: {
      background:
        "rgba(255,255,255,0.08)",
      borderRadius: "12px",
      padding: "16px",
      textAlign:
        "center" as const,
      backdropFilter:
        "blur(5px)",
      border:
        "1px solid rgba(255,255,255,0.1)",
    },

    printerCard: {
      background:
        "rgba(255,255,255,0.08)",
      borderRadius: "14px",
      padding: "18px",
      border:
        "1px solid rgba(255,255,255,0.12)",
    },

    assignmentBadge: {
      padding: "5px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight:
        "700",
      display:
        "inline-block",
    },

    logContainer: {
      background:
        "rgba(0, 0, 0, 0.4)",
      backdropFilter:
        "blur(10px)",
      color: "#98fb98",
      padding: "16px",
      borderRadius: "12px",
      height: "320px",
      overflowY:
        "auto" as const,
      fontFamily:
        "'Fira Code', 'Courier New', monospace",
      fontSize: "13px",
      border:
        "1px solid rgba(255,255,255,0.1)",
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div style={styles.container}>
      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div style={styles.header}>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1
              style={{
                margin:
                  "0 0 4px 0",
                fontSize: "28px",
                fontWeight:
                  "700",
                background:
                  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                WebkitBackgroundClip:
                  "text",
                WebkitTextFillColor:
                  "transparent",
              }}
            >
              🖨️ OneBalance Printer
            </h1>

            <p
              style={{
                margin: 0,
                color:
                  "rgba(255,255,255,0.8)",
                fontSize: "14px",
              }}
            >
              {printCount} prints •
              {" "}
              Status: {status}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...styles.statusBadge,
                background: ready
                  ? "rgba(76,175,80,0.3)"
                  : "rgba(244,67,54,0.3)",
                border: ready
                  ? "1px solid #4caf50"
                  : "1px solid #f44336",
                color: ready
                  ? "#81c784"
                  : "#ef9a9a",
              }}
            >
              {ready
                ? "● Ready"
                : "● Offline"}
            </span>

            {connected && (
              <span
                style={{
                  ...styles.statusBadge,
                  background:
                    "rgba(33,150,243,0.3)",
                  border:
                    "1px solid #42a5f5",
                  color: "#64b5f6",
                }}
              >
                ● Connected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* NAVIGATION */}
      {/* ====================================================== */}

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {(
          [
            "dashboard",
            "printers",
            "logs",
          ] as const
        ).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() =>
              setViewMode(mode)
            }
            style={{
              ...styles.button,
              background:
                viewMode === mode
                  ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                  : "rgba(255,255,255,0.08)",
              color:
                viewMode === mode
                  ? "#ffffff"
                  : "rgba(255,255,255,0.8)",
              border:
                viewMode === mode
                  ? "none"
                  : "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {mode === "dashboard"
              ? "Dashboard"
              : mode === "printers"
                ? "Printers"
                : "Logs"}
          </button>
        ))}
      </div>

      {/* ====================================================== */}
      {/* DASHBOARD */}
      {/* ====================================================== */}

      {viewMode === "dashboard" && (
        <div>
          {/* STATUS */}

          <div style={styles.card}>
            <h3
              style={{
                margin:
                  "0 0 16px 0",
                fontSize: "18px",
                fontWeight:
                  "600",
              }}
            >
              📊 Printer Status
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={
                  styles.statCard
                }
              >
                <div
                  style={{
                    color:
                      "rgba(255,255,255,0.6)",
                    fontSize:
                      "12px",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Connected
                </div>

                <div
                  style={{
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      "600",
                    marginTop:
                      "4px",
                  }}
                >
                  {connected
                    ? "✅ Yes"
                    : "❌ No"}
                </div>
              </div>

              <div
                style={
                  styles.statCard
                }
              >
                <div
                  style={{
                    color:
                      "rgba(255,255,255,0.6)",
                    fontSize:
                      "12px",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Ready
                </div>

                <div
                  style={{
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      "600",
                    marginTop:
                      "4px",
                  }}
                >
                  {ready
                    ? "✅ Yes"
                    : "❌ No"}
                </div>
              </div>

              <div
                style={
                  styles.statCard
                }
              >
                <div
                  style={{
                    color:
                      "rgba(255,255,255,0.6)",
                    fontSize:
                      "12px",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Printers
                </div>

                <div
                  style={{
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      "600",
                    marginTop:
                      "4px",
                  }}
                >
                  {printers.length}
                </div>
              </div>

              <div
                style={
                  styles.statCard
                }
              >
                <div
                  style={{
                    color:
                      "rgba(255,255,255,0.6)",
                    fontSize:
                      "12px",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Prints
                </div>

                <div
                  style={{
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      "600",
                    marginTop:
                      "4px",
                  }}
                >
                  {printCount}
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  color: "#ef9a9a",
                  marginTop:
                    "12px",
                  fontSize:
                    "14px",
                  padding:
                    "10px 16px",
                  borderRadius:
                    "8px",
                  background:
                    "rgba(244,67,54,0.15)",
                  border:
                    "1px solid rgba(244,67,54,0.3)",
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* CURRENT ASSIGNMENTS */}

          <div style={styles.card}>
            <h3
              style={{
                margin:
                  "0 0 16px 0",
                fontSize: "18px",
                fontWeight:
                  "600",
              }}
            >
              🔗 Current Assignments
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={
                  styles.printerCard
                }
              >
                <div
                  style={{
                    fontSize:
                      "13px",
                    color:
                      "rgba(255,255,255,0.6)",
                    marginBottom:
                      "6px",
                  }}
                >
                  🧾 RECEIPT
                </div>

                <div
                  style={{
                    fontSize:
                      "16px",
                    fontWeight:
                      "700",
                  }}
                >
                  {assignments
                    .RECEIPT
                    ?.printerName ??
                    "Not assigned"}
                </div>

                {assignments.RECEIPT && (
                  <div
                    style={{
                      marginTop:
                        "5px",
                      fontSize:
                        "12px",
                      color:
                        "rgba(255,255,255,0.65)",
                    }}
                  >
                    ID:{" "}
                    {
                      assignments
                        .RECEIPT
                        .printerId
                    }
                  </div>
                )}
              </div>

              <div
                style={
                  styles.printerCard
                }
              >
                <div
                  style={{
                    fontSize:
                      "13px",
                    color:
                      "rgba(255,255,255,0.6)",
                    marginBottom:
                      "6px",
                  }}
                >
                  🍳 KITCHEN
                </div>

                <div
                  style={{
                    fontSize:
                      "16px",
                    fontWeight:
                      "700",
                  }}
                >
                  {assignments
                    .KITCHEN
                    ?.printerName ??
                    "Not assigned"}
                </div>

                {assignments.KITCHEN && (
                  <div
                    style={{
                      marginTop:
                        "5px",
                      fontSize:
                        "12px",
                      color:
                        "rgba(255,255,255,0.65)",
                    }}
                  >
                    ID:{" "}
                    {
                      assignments
                        .KITCHEN
                        .printerId
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CONTROLS */}

          <div style={styles.card}>
            <h3
              style={{
                margin:
                  "0 0 16px 0",
                fontSize: "18px",
                fontWeight:
                  "600",
              }}
            >
              🎮 Controls
            </h3>

            <div
              style={{
                marginBottom:
                  "16px",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom:
                    "8px",
                  color:
                    "rgba(255,255,255,0.8)",
                  fontSize:
                    "14px",
                  fontWeight:
                    "500",
                }}
              >
                Order Type:
              </label>

              <div
                style={{
                  display:
                    "flex",
                  gap: "10px",
                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOrderType(
                      "takeaway",
                    )
                  }
                  style={{
                    ...styles.button,
                    background:
                      orderType ===
                      "takeaway"
                        ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  🛍️ Takeaway
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOrderType(
                      "table",
                    )
                  }
                  style={{
                    ...styles.button,
                    background:
                      orderType ===
                      "table"
                        ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  🍽️ Table ($)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptType("refund")
                  }
                  style={{
                    ...styles.button,
                    background:
                      receiptType === "refund"
                        ? "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  ↩️ Refund
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptType("void")
                  }
                  style={{
                    ...styles.button,
                    background:
                      receiptType === "void"
                        ? "linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  ✕ Void
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReceiptType("sale")
                  }
                  style={{
                    ...styles.button,
                    background:
                      receiptType === "sale"
                        ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  💳 Sale
                </button>
              </div>
            </div>

            <div
              style={{
                display:
                  "flex",
                gap: "10px",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  void initializePrinter()
                }
                disabled={
                  isAssigning
                }
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity:
                    isAssigning
                      ? 0.6
                      : 1,
                }}
              >
                🔧 Init
              </button>

              <button
                type="button"
                onClick={() =>
                  void checkStatus()
                }
                disabled={
                  isAssigning
                }
                style={{
                  ...styles.button,
                  opacity:
                    isAssigning
                      ? 0.6
                      : 1,
                }}
              >
                📊 Status
              </button>

              <button
                type="button"
                onClick={() =>
                  void printTest(
                    "RECEIPT",
                  )
                }
                disabled={
                  !ready ||
                  printingTag !== null ||
                  !assignments.RECEIPT
                }
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity:
                    !ready ||
                    printingTag !==
                      null ||
                    !assignments.RECEIPT
                      ? 0.5
                      : 1,
                }}
              >
                {printingTag ===
                "RECEIPT"
                  ? "⏳ Printing..."
                  : "🧾 Receipt Test"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void printTest(
                    "KITCHEN",
                  )
                }
                disabled={
                  !ready ||
                  printingTag !== null ||
                  !assignments.KITCHEN
                }
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity:
                    !ready ||
                    printingTag !==
                      null ||
                    !assignments.KITCHEN
                      ? 0.5
                      : 1,
                }}
              >
                {printingTag ===
                "KITCHEN"
                  ? "⏳ Printing..."
                  : "🍳 Kitchen Test"}
              </button>

              <button
                type="button"
                onClick={() =>
                  void printReceipt(
                    "RECEIPT",
                  )
                }
                disabled={
                  !ready ||
                  printingTag !== null ||
                  !assignments.RECEIPT
                }
                style={{
                  ...styles.button,
                  opacity:
                    !ready ||
                    printingTag !==
                      null ||
                    !assignments.RECEIPT
                      ? 0.5
                      : 1,
                }}
              >
                🧾 Print Receipt
              </button>

              <button
                type="button"
                onClick={() =>
                  void printReceipt(
                    "KITCHEN",
                  )
                }
                disabled={
                  !ready ||
                  printingTag !== null ||
                  !assignments.KITCHEN
                }
                style={{
                  ...styles.button,
                  opacity:
                    !ready ||
                    printingTag !==
                      null ||
                    !assignments.KITCHEN
                      ? 0.5
                      : 1,
                }}
              >
                🍳 Print Kitchen
              </button>
                <SalesReceiptButton
                  tag="RECEIPT"
                  disabled={!ready || printingTag !== null || !assignments.RECEIPT}
                  onLog={addLog}
                />
              <button
                type="button"
                onClick={() =>
                  void destroyPrinter()
                }
                disabled={
                  isAssigning ||
                  printingTag !== null
                }
                style={{
                  ...styles.button,
                  ...styles.dangerButton,
                  opacity:
                    isAssigning ||
                    printingTag !== null
                      ? 0.6
                      : 1,
                }}
              >
                💥 Destroy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* PRINTERS */}
      {/* ====================================================== */}

      {viewMode === "printers" && (
        <div>
          <div style={styles.card}>
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "12px",
                flexWrap:
                  "wrap",
                marginBottom:
                  "18px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize:
                      "20px",
                    fontWeight:
                      "700",
                  }}
                >
                  🖨️ Printer Selection
                </h3>

                <p
                  style={{
                    margin:
                      "6px 0 0 0",
                    color:
                      "rgba(255,255,255,0.65)",
                    fontSize:
                      "13px",
                  }}
                >
                  Select printers for
                  RECEIPT and KITCHEN.
                  Assignments are saved
                  by printer ID.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadPrinters()
                }
                disabled={
                  isLoadingPrinters
                }
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity:
                    isLoadingPrinters
                      ? 0.6
                      : 1,
                }}
              >
                {isLoadingPrinters
                  ? "⏳ Refreshing..."
                  : "🔄 Refresh"}
              </button>
            </div>

            {printers.length === 0 ? (
              <div
                style={{
                  padding:
                    "32px",
                  textAlign:
                    "center",
                  borderRadius:
                    "12px",
                  background:
                    "rgba(255,255,255,0.05)",
                  color:
                    "rgba(255,255,255,0.7)",
                }}
              >
                No printers found.

                <div
                  style={{
                    marginTop:
                      "8px",
                    fontSize:
                      "12px",
                  }}
                >
                  Add/save external
                  printers through the
                  SUNMI Printer Service
                  first, then refresh.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "14px",
                }}
              >
                {printers.map(
                  (printer) => {
                    const {
                      isReceipt,
                      isKitchen,
                    } =
                      getAssignmentForPrinter(
                        printer.id,
                      );

                    return (
                      <div
                        key={
                          printer.id
                        }
                        style={
                          styles.printerCard
                        }
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap:
                              "12px",
                            alignItems:
                              "flex-start",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize:
                                  "18px",
                                fontWeight:
                                  "700",
                              }}
                            >
                              {
                                printer.name
                              }
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "6px",
                                fontSize:
                                  "12px",
                                color:
                                  "rgba(255,255,255,0.6)",
                              }}
                            >
                              ID:{" "}
                              {
                                printer.id
                              }
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "4px",
                                fontSize:
                                  "12px",
                                color:
                                  "rgba(255,255,255,0.6)",
                              }}
                            >
                              Type:{" "}
                              {
                                printer.type
                              }
                            </div>

                            <div
                              style={{
                                marginTop:
                                  "4px",
                                fontSize:
                                  "12px",
                                color:
                                  "rgba(255,255,255,0.6)",
                              }}
                            >
                              Index:{" "}
                              {
                                printer.index
                              }
                            </div>
                          </div>

                          <span
                            style={{
                              ...styles.assignmentBadge,
                              background:
                                printer.connected ===
                                false
                                  ? "rgba(244,67,54,0.2)"
                                  : "rgba(76,175,80,0.2)",
                              border:
                                printer.connected ===
                                false
                                  ? "1px solid rgba(244,67,54,0.5)"
                                  : "1px solid rgba(76,175,80,0.5)",
                            }}
                          >
                            {printer.connected ===
                            false
                              ? "Offline"
                              : "Connected"}
                          </span>
                        </div>

                        {/* ASSIGNMENT BADGES */}

                        <div
                          style={{
                            display:
                              "flex",
                            gap: "7px",
                            flexWrap:
                              "wrap",
                            marginTop:
                              "14px",
                          }}
                        >
                          {isReceipt && (
                            <span
                              style={{
                                ...styles.assignmentBadge,
                                background:
                                  "rgba(33,150,243,0.22)",
                                border:
                                  "1px solid rgba(33,150,243,0.65)",
                                color:
                                  "#90caf9",
                              }}
                            >
                              🧾 RECEIPT
                            </span>
                          )}

                          {isKitchen && (
                            <span
                              style={{
                                ...styles.assignmentBadge,
                                background:
                                  "rgba(255,152,0,0.22)",
                                border:
                                  "1px solid rgba(255,152,0,0.65)",
                                color:
                                  "#ffcc80",
                              }}
                            >
                              🍳 KITCHEN
                            </span>
                          )}

                          {!isReceipt &&
                            !isKitchen && (
                              <span
                                style={{
                                  ...styles.assignmentBadge,
                                  background:
                                    "rgba(255,255,255,0.08)",
                                  border:
                                    "1px solid rgba(255,255,255,0.15)",
                                  color:
                                    "rgba(255,255,255,0.65)",
                                }}
                              >
                                Not assigned
                              </span>
                            )}

                          {printer.selected && (
                            <span
                              style={{
                                ...styles.assignmentBadge,
                                background:
                                  "rgba(156,39,176,0.2)",
                                border:
                                  "1px solid rgba(156,39,176,0.55)",
                                color:
                                  "#ce93d8",
                              }}
                            >
                              ● Selected
                            </span>
                          )}
                        </div>

                        {/* ACTIONS */}

                        <div
                          style={{
                            display:
                              "flex",
                            flexDirection:
                              "column",
                            gap: "8px",
                            marginTop:
                              "16px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              void assignPrinter(
                                "RECEIPT",
                                printer,
                              )
                            }
                            disabled={
                              isAssigning ||
                              isReceipt
                            }
                            style={{
                              ...styles.button,
                              background:
                                isReceipt
                                  ? "rgba(76,175,80,0.25)"
                                  : "rgba(255,255,255,0.12)",
                              border:
                                isReceipt
                                  ? "1px solid rgba(76,175,80,0.6)"
                                  : "1px solid rgba(255,255,255,0.18)",
                              opacity:
                                isAssigning ||
                                isReceipt
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            {isReceipt
                              ? "✓ Assigned to RECEIPT"
                              : "🧾 Assign as RECEIPT"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void assignPrinter(
                                "KITCHEN",
                                printer,
                              )
                            }
                            disabled={
                              isAssigning ||
                              isKitchen
                            }
                            style={{
                              ...styles.button,
                              background:
                                isKitchen
                                  ? "rgba(255,152,0,0.2)"
                                  : "rgba(255,255,255,0.12)",
                              border:
                                isKitchen
                                  ? "1px solid rgba(255,152,0,0.6)"
                                  : "1px solid rgba(255,255,255,0.18)",
                              opacity:
                                isAssigning ||
                                isKitchen
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            {isKitchen
                              ? "✓ Assigned to KITCHEN"
                              : "🍳 Assign as KITCHEN"}
                          </button>

                          {isReceipt && (
                            <button
                              type="button"
                              onClick={() =>
                                void removeAssignment(
                                  "RECEIPT",
                                )
                              }
                              disabled={
                                isAssigning
                              }
                              style={{
                                ...styles.button,
                                opacity:
                                  isAssigning
                                    ? 0.5
                                    : 1,
                              }}
                            >
                              ✕ Remove RECEIPT
                            </button>
                          )}

                          {isKitchen && (
                            <button
                              type="button"
                              onClick={() =>
                                void removeAssignment(
                                  "KITCHEN",
                                )
                              }
                              disabled={
                                isAssigning
                              }
                              style={{
                                ...styles.button,
                                opacity:
                                  isAssigning
                                    ? 0.5
                                    : 1,
                              }}
                            >
                              ✕ Remove KITCHEN
                            </button>
                          )}

                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "8px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void printTest(
                                  "RECEIPT",
                                )
                              }
                              disabled={
                                !ready ||
                                printingTag !==
                                  null ||
                                !isReceipt
                              }
                              style={{
                                ...styles.button,
                                flex: 1,
                                opacity:
                                  !ready ||
                                  printingTag !==
                                    null ||
                                  !isReceipt
                                    ? 0.45
                                    : 1,
                              }}
                            >
                              {printingTag ===
                              "RECEIPT"
                                ? "⏳"
                                : "🧾 Test"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void printTest(
                                  "KITCHEN",
                                )
                              }
                              disabled={
                                !ready ||
                                printingTag !==
                                  null ||
                                !isKitchen
                              }
                              style={{
                                ...styles.button,
                                flex: 1,
                                opacity:
                                  !ready ||
                                  printingTag !==
                                    null ||
                                  !isKitchen
                                    ? 0.45
                                    : 1,
                              }}
                            >
                              {printingTag ===
                              "KITCHEN"
                                ? "⏳"
                                : "🍳 Test"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* ASSIGNMENT SUMMARY */}

          <div style={styles.card}>
            <h3
              style={{
                margin:
                  "0 0 14px 0",
                fontSize:
                  "18px",
                fontWeight:
                  "600",
              }}
            >
              📌 Assignment Summary
            </h3>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {(
                [
                  "RECEIPT",
                  "KITCHEN",
                ] as const
              ).map((tag) => {
                const assignment =
                  assignments[tag];

                return (
                  <div
                    key={tag}
                    style={
                      styles.printerCard
                    }
                  >
                    <div
                      style={{
                        fontSize:
                          "13px",
                        color:
                          "rgba(255,255,255,0.6)",
                      }}
                    >
                      {tag ===
                      "RECEIPT"
                        ? "🧾 RECEIPT"
                        : "🍳 KITCHEN"}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "7px",
                        fontSize:
                          "16px",
                        fontWeight:
                          "700",
                      }}
                    >
                      {assignment
                        ?.printerName ??
                        "Not assigned"}
                    </div>

                    {assignment && (
                      <>
                        <div
                          style={{
                            marginTop:
                              "5px",
                            fontSize:
                              "12px",
                            color:
                              "rgba(255,255,255,0.6)",
                          }}
                        >
                          ID:{" "}
                          {
                            assignment.printerId
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "3px",
                            fontSize:
                              "12px",
                            color:
                              "rgba(255,255,255,0.6)",
                          }}
                        >
                          Type:{" "}
                          {
                            assignment.type
                          }
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* LOGS */}
      {/* ====================================================== */}

      {viewMode === "logs" && (
        <div style={styles.card}>
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "12px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize:
                  "18px",
                fontWeight:
                  "600",
              }}
            >
              📋 Activity Log
            </h3>

            <button
              type="button"
              onClick={() =>
                setLogs([])
              }
              style={{
                ...styles.button,
                fontSize:
                  "12px",
                padding:
                  "6px 14px",
              }}
            >
              Clear
            </button>
          </div>

          <div
            ref={logContainerRef}
            style={
              styles.logContainer
            }
          >
            {logs.length === 0 ? (
              <div
                style={{
                  textAlign:
                    "center",
                  paddingTop:
                    "100px",
                  color:
                    "rgba(255,255,255,0.3)",
                }}
              >
                No activity yet...
              </div>
            ) : (
              logs.map(
                (
                  line,
                  index,
                ) => (
                  <div
                    key={`${line}-${index}`}
                    style={{
                      marginBottom:
                        "3px",
                    }}
                  >
                    {line}
                  </div>
                ),
              )
            )}
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* NOTIFICATION */}
      {/* ====================================================== */}

      {notification && (
        <div
          style={{
            position:
              "fixed",
            bottom:
              "24px",
            right:
              "24px",
            padding:
              "14px 24px",
            borderRadius:
              "14px",
            background:
              notification.type ===
              "success"
                ? "linear-gradient(135deg, #43a047, #66bb6a)"
                : notification.type ===
                    "error"
                  ? "linear-gradient(135deg, #e53935, #ef5350)"
                  : "rgba(255,255,255,0.15)",
            backdropFilter:
              "blur(20px)",
            color:
              "#ffffff",
            boxShadow:
              "0 12px 48px rgba(0,0,0,0.3)",
            zIndex:
              1000,
            maxWidth:
              "420px",
            border:
              "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {notification.message}
        </div>
      )}

      {/* ====================================================== */}
      {/* GLOBAL STYLES */}
      {/* ====================================================== */}

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%) scale(0.9);
              opacity: 0;
            }

            to {
              transform: translateX(0) scale(1);
              opacity: 1;
            }
          }

          * {
            box-sizing: border-box;
          }

          ::-webkit-scrollbar {
            width: 6px;
          }

          ::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb {
            background: linear-gradient(
              135deg,
              #f093fb 0%,
              #f5576c 100%
            );
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(
              135deg,
              #f5576c 0%,
              #f093fb 100%
            );
          }

          button:disabled {
            cursor: not-allowed;
          }
        `}
      </style>
    </div>
  );
}

export default App;
