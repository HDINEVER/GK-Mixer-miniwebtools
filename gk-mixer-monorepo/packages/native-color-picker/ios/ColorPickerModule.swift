import Foundation
import UIKit
import React

// MARK: - ColorPickerModule
// Legacy RCTBridgeModule pattern — auto-registered by RN's module discovery.
// Works with both new & old architecture via the interop layer.

@objc(ColorPickerModule)
public class ColorPickerModule: NSObject {

  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private var pickerVC: UIColorPickerViewController?

  @objc public static func requiresMainQueueSetup() -> Bool {
    return true
  }

  // MARK: - Exported method

  @objc public func showColorPicker(
    _ hexColor: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      guard let rootVC = self.topViewController() else {
        reject("ERROR", "找不到顶层视图控制器", nil)
        return
      }

      self.pendingResolve = resolve
      self.pendingReject = reject

      let picker = UIColorPickerViewController()
      picker.selectedColor = self.hexToUIColor(hexColor)
      picker.supportsAlpha = false
      picker.title = "选择颜色"
      picker.delegate = self
      self.pickerVC = picker

      rootVC.present(picker, animated: true)
    }
  }

  // MARK: - Helpers

  private func topViewController() -> UIViewController? {
    var top = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first(where: \.isKeyWindow)?
      .rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }

  private func hexToUIColor(_ hex: String) -> UIColor {
    let cleaned = hex.trimmingCharacters(in: .init(charactersIn: "#"))
    guard cleaned.count == 6,
          let rgb = UInt32(cleaned, radix: 16) else {
      return .label
    }
    return UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }

  private func uiColorToHex(_ color: UIColor) -> String {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    color.getRed(&r, green: &g, blue: &b, alpha: &a)
    return String(format: "#%02X%02X%02X",
                  Int(r * 255), Int(g * 255), Int(b * 255))
  }
}

// MARK: - UIColorPickerViewControllerDelegate

extension ColorPickerModule: UIColorPickerViewControllerDelegate {
  public func colorPickerViewController(_ vc: UIColorPickerViewController, didSelect color: UIColor, continuously: Bool) {
    let hex = uiColorToHex(color)
    if let resolve = pendingResolve {
      resolve(hex)
      if !continuously {
        pendingResolve = nil
        pendingReject = nil
      }
    }
  }

  public func colorPickerViewControllerDidFinish(_ vc: UIColorPickerViewController) {
    let hex = uiColorToHex(vc.selectedColor)
    if let resolve = pendingResolve {
      resolve(hex)
    }
    pendingResolve = nil
    pendingReject = nil
    pickerVC = nil
  }
}
