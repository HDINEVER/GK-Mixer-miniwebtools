require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "RNColorPicker"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = "https://github.com/gk-mixer"
  s.license      = package['license']
  s.author       = "GK Mixer"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "v#{s.version}" }
  s.source_files = "ios/ColorPickerModule.swift"
  s.static_framework = true
  s.swift_version = "5.0"

  s.dependency "React-Core"
  s.dependency "React-RCTAppDelegate"
end
