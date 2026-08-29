require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-collapsible-tabs-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => package["repository"]["url"], :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  # The ObjC++ view header imports C++ Fabric headers; it must stay out of
  # the pod's umbrella header or clang cannot build the module. Nothing needs
  # to import it: the .mm forward-declares the Swift class, and the Swift
  # file is pure UIKit.
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.0"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
  }

  # Fabric / codegen wiring for the host app (React-Core, RCT-Folly, codegen
  # headers, etc.). Requires React Native >= 0.71.
  install_modules_dependencies(s)
end
