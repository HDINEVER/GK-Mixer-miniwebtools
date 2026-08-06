// GK Mixer Native Color Picker
// RN 0.86 New Architecture: try NativeModules first, fallback to TurboModuleRegistry
import { NativeModules, TurboModuleRegistry } from 'react-native';

interface ColorPickerModule {
  showColorPicker(hexColor: string): Promise<string>;
}

const NativeColorPicker: ColorPickerModule | undefined =
  NativeModules.ColorPickerModule ??
  (TurboModuleRegistry.get as any)?.('ColorPickerModule');

export { NativeColorPicker as default };
