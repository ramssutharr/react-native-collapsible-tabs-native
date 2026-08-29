package com.collapsibletabs

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.ModuleSpec
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.collapsibletabs.bridge.CollapsibleTabsViewManager

/**
 * Registration surface for the native collapsible-tabs shell.
 * `BaseReactPackage`
 * and the eager `getViewManagers` override are both required under
 * bridgeless.
 */
class CollapsibleTabsPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider { emptyMap() }

  override fun getViewManagers(reactContext: ReactApplicationContext): List<ModuleSpec> =
    listOf(
      ModuleSpec.viewManagerSpec { CollapsibleTabsViewManager(reactContext) },
    )
}
