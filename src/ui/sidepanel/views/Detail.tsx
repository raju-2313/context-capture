export default function CaptureDetail({ captureId }: { captureId: string }) {
  return (
    <div class="container">
      <div class="empty-state" style={{ height: "auto" }}>
        <h3>Capture Detail</h3>
        <p>Capture ID: {captureId}</p>
        <p>Detail view coming in next build step.</p>
      </div>
    </div>
  );
}
