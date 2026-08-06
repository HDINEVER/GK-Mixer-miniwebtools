// ColorPickerModule.m — ObjC bridge to force-register the Swift module
// Required for RN 0.86 bridgeless (RCTReactNativeFactory) where
// @objc swift classes aren't auto-discovered.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(ColorPickerModule, NSObject)

RCT_EXTERN_METHOD(
  showColorPicker:(NSString *)hexColor
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
