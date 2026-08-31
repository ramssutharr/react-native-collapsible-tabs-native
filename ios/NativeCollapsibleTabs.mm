#import "NativeCollapsibleTabs.h"

#import <react/renderer/components/RNCollapsibleTabsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNCollapsibleTabsSpec/EventEmitters.h>
#import <react/renderer/components/RNCollapsibleTabsSpec/Props.h>
#import <react/renderer/components/RNCollapsibleTabsSpec/RCTComponentViewHelpers.h>

#import <React/RCTFabricComponentsPlugins.h>
#import <React/RCTScrollViewComponentView.h>

// Forward-declared Swift surface (the library has no Swift umbrella import; the
// Swift @objc(NativeCollapsibleTabsContent)
// registers the class with the runtime, so this declaration links.
@interface NativeCollapsibleTabsContent : UIView
- (void)setHeaderHeight:(CGFloat)height;
- (void)setTabBarHeight:(CGFloat)height;
- (void)setPageCount:(NSInteger)count;
- (void)setSelectedIndex:(NSInteger)index;
- (void)setCollapseThreshold:(CGFloat)threshold;
- (void)setSwipeEnabled:(BOOL)enabled;
- (void)setCollapseMode:(NSString *)mode;
- (void)setRefreshing:(BOOL)refreshing;
- (void)mountChild:(UIView *)child nativeId:(NSString *_Nullable)nativeId index:(NSInteger)index;
- (void)unmountChild:(UIView *)child;
- (void)handleScrollViewDidScroll:(UIScrollView *)scrollView;
- (void)handleScrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate;
- (void)handleScrollViewWillBeginDragging:(UIScrollView *)scrollView;
- (void)reset;
/// Given a mounted page root, returns the page's main vertical scroll view
/// (and makes sure the host is listening to it). RN-specific, so it lives on
/// the ObjC++ side.
@property (nonatomic, copy, nullable) UIScrollView *_Nullable (^scrollViewResolver)(UIView *pageRoot);
@property (nonatomic, copy, nullable) void (^onPageSelected)(NSInteger index);
@property (nonatomic, copy, nullable) void (^onCollapsedChange)(BOOL collapsed);
@property (nonatomic, copy, nullable) void (^onRefresh)(void);
/// Cancels React's in-flight JS touches (so a Pressable under the finger does
/// not fire when a scroll/drag starts). RN-specific, provided by the host.
@property (nonatomic, copy, nullable) void (^cancelReactTouches)(void);
@end

using namespace facebook::react;

@interface NativeCollapsibleTabs () <RCTNativeCollapsibleTabsViewProtocol, UIScrollViewDelegate>
@end

@implementation NativeCollapsibleTabs {
  NativeCollapsibleTabsContent *_content;
  /// Scroll views we registered as a listener on (weak: RN owns them).
  NSHashTable<RCTScrollViewComponentView *> *_listened;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<NativeCollapsibleTabsComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const NativeCollapsibleTabsProps>();
    _props = defaultProps;
    _listened = [NSHashTable weakObjectsHashTable];

    _content = [[NativeCollapsibleTabsContent alloc] initWithFrame:self.bounds];
    _content.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self addSubview:_content];

    __weak NativeCollapsibleTabs *weakSelf = self;
    _content.scrollViewResolver = ^UIScrollView *_Nullable(UIView *pageRoot) {
      return [weakSelf resolveScrollViewIn:pageRoot];
    };
    _content.onPageSelected = ^(NSInteger index) {
      [weakSelf emitPageSelected:index];
    };
    _content.onCollapsedChange = ^(BOOL collapsed) {
      [weakSelf emitCollapsedChange:collapsed];
    };
    _content.onRefresh = ^{
      [weakSelf emitRefresh];
    };
    _content.cancelReactTouches = ^{
      [weakSelf cancelReactTouches];
    };
  }
  return self;
}

#pragma mark - React touch cancellation

/// React Native's `RCTSurfaceTouchHandler` (a gesture recognizer on the
/// surface view) only cancels JS touches when it happens to negotiate with
/// the recognizer that took over. The shell's own pans are not always in that
/// negotiation, so when a scroll or drag starts here we cancel it explicitly
/// — toggling `enabled` is exactly what RN's `_cancelTouches` does.
- (void)cancelReactTouches
{
  Class handlerClass = NSClassFromString(@"RCTSurfaceTouchHandler");
  if (handlerClass == nil) {
    return;
  }
  UIView *view = self;
  while (view != nil) {
    for (UIGestureRecognizer *recognizer in view.gestureRecognizers) {
      if ([recognizer isKindOfClass:handlerClass]) {
        recognizer.enabled = NO;
        recognizer.enabled = YES;
        return;
      }
    }
    view = view.superview;
  }
}

#pragma mark - Scroll view discovery + listening

/// Breadth-first so a nested vertical list inside a cell never wins.
- (UIScrollView *_Nullable)resolveScrollViewIn:(UIView *)root
{
  NSMutableArray<UIView *> *queue = [NSMutableArray arrayWithObject:root];
  NSUInteger visited = 0;
  while (queue.count > 0 && visited < 4000) {
    UIView *view = queue.firstObject;
    [queue removeObjectAtIndex:0];
    visited++;
    if ([view isKindOfClass:[RCTScrollViewComponentView class]]) {
      RCTScrollViewComponentView *component = (RCTScrollViewComponentView *)view;
      // Only vertical lists: a horizontal RN ScrollView (pinned categories,
      // socials row) also comes through this class.
      if (component.scrollView.contentSize.height >= component.scrollView.contentSize.width ||
          component.scrollView.alwaysBounceVertical) {
        if (![_listened containsObject:component]) {
          [component addScrollListener:self];
          [_listened addObject:component];
        }
        return component.scrollView;
      }
    }
    [queue addObjectsFromArray:view.subviews];
  }
  return nil;
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  [_content handleScrollViewDidScroll:scrollView];
}

- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate
{
  [_content handleScrollViewDidEndDragging:scrollView willDecelerate:decelerate];
}

- (void)scrollViewWillBeginDragging:(UIScrollView *)scrollView
{
  [_content handleScrollViewWillBeginDragging:scrollView];
}

#pragma mark - RN children

- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  NSString *nativeId = nil;
  if ([childComponentView respondsToSelector:@selector(nativeId)]) {
    nativeId = [(id)childComponentView nativeId];
  }
  [_content mountChild:childComponentView nativeId:nativeId index:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [_content unmountChild:childComponentView];
}

#pragma mark - Events

- (void)emitPageSelected:(NSInteger)index
{
  if (_eventEmitter == nullptr) {
    return;
  }
  auto emitter = std::static_pointer_cast<const NativeCollapsibleTabsEventEmitter>(_eventEmitter);
  emitter->onPageSelected({.index = static_cast<int>(index)});
}

- (void)emitCollapsedChange:(BOOL)collapsed
{
  if (_eventEmitter == nullptr) {
    return;
  }
  auto emitter = std::static_pointer_cast<const NativeCollapsibleTabsEventEmitter>(_eventEmitter);
  emitter->onCollapsedChange({.collapsed = static_cast<bool>(collapsed)});
}

- (void)emitRefresh
{
  if (_eventEmitter == nullptr) {
    return;
  }
  auto emitter = std::static_pointer_cast<const NativeCollapsibleTabsEventEmitter>(_eventEmitter);
  emitter->onRefresh({});
}

#pragma mark - Props

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<const NativeCollapsibleTabsProps>(props);
  const auto &previousProps = oldProps == nullptr
      ? *std::static_pointer_cast<const NativeCollapsibleTabsProps>(_props)
      : *std::static_pointer_cast<const NativeCollapsibleTabsProps>(oldProps);

  if (oldProps == nullptr || newProps.headerHeight != previousProps.headerHeight) {
    [_content setHeaderHeight:newProps.headerHeight];
  }
  if (oldProps == nullptr || newProps.tabBarHeight != previousProps.tabBarHeight) {
    [_content setTabBarHeight:newProps.tabBarHeight];
  }
  if (oldProps == nullptr || newProps.collapseThreshold != previousProps.collapseThreshold) {
    [_content setCollapseThreshold:newProps.collapseThreshold];
  }
  if (oldProps == nullptr || newProps.swipeEnabled != previousProps.swipeEnabled) {
    [_content setSwipeEnabled:newProps.swipeEnabled];
  }
  if (oldProps == nullptr || newProps.collapseMode != previousProps.collapseMode) {
    [_content setCollapseMode:[NSString stringWithUTF8String:newProps.collapseMode.c_str()]];
  }
  // pageCount before selectedIndex: the selection is clamped to the page count.
  if (oldProps == nullptr || newProps.pageCount != previousProps.pageCount) {
    [_content setPageCount:newProps.pageCount];
  }
  if (oldProps == nullptr || newProps.selectedIndex != previousProps.selectedIndex) {
    [_content setSelectedIndex:newProps.selectedIndex];
  }
  if (oldProps == nullptr || newProps.refreshing != previousProps.refreshing) {
    [_content setRefreshing:newProps.refreshing];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_content reset];
  [_listened removeAllObjects];
}

@end

Class<RCTComponentViewProtocol> NativeCollapsibleTabsCls(void)
{
  return NativeCollapsibleTabs.class;
}
