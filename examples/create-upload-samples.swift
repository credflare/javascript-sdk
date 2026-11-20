import AppKit

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for side in ["front", "back"] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1200, pixelsHigh: 760, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor.white.setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1200, height: 760)).fill()
    func text(_ value: String, _ y: CGFloat, _ size: CGFloat, _ color: NSColor = .black) {
        (value as NSString).draw(at: NSPoint(x: 64, y: y), withAttributes: [.font: NSFont.systemFont(ofSize: size), .foregroundColor: color])
    }
    text("SAMPLE DOCUMENT", 650, 52, .systemBlue)
    text("NOT A REAL ID - FOR UPLOAD TESTING ONLY", 590, 30, .systemRed)
    text(side.uppercased() + " SIDE", 490, 42)
    text("Name: Example Person", 385, 32)
    text("Reference: SAMPLE-0001", 315, 32)
    text(side == "front" ? "Issued: 2026-01-01" : "Expires: 2030-01-01", 245, 32)
    text("Synthetic test data. No real personal information.", 105, 28)
    text("Select this file when the flow asks for the " + side + ".", 55, 25)
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("sample-" + side + ".png"))
}
