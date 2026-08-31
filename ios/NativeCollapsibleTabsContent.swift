import UIKit

/// The collapsible-tabs shell on iOS: a collapsing header band and a pinned tab-bar
/// band over a horizontal paging scroll view of React pages. Counterpart of
/// the Android `CollapsibleTabsHostView`; same JS contract
/// (`NativeCollapsibleTabsNativeComponent.ts`).
///
/// Geometry (points, host-relative):
///
///   pager      : bounds                       — pages pad their content by
///                                               headerH + tabH at the top
///   headerSlot : (0, 0, w, headerH)           — translated by -offset (+pull)
///   tabBarSlot : (0, headerH, w, headerH+tabH) — translated the same
///   offset     : clamp(activePage.contentOffset.y, 0, headerH)
///   pull       : max(0, -activePage.contentOffset.y)   (bounce / refresh)
///
/// The offset is read from the active page's scroll view delegate callback,
/// which UIKit invokes synchronously inside the content-offset change — the
/// band transform is written before the frame that shows the new offset, so
/// header and list cannot be a frame apart (the whole point of this shell).
///
/// Everything RN-specific (finding a page's `RCTScrollViewComponentView`,
/// registering as its scroll listener) is injected by NativeCollapsibleTabs.mm
/// through `scrollViewResolver`, so this file stays plain UIKit.
@objc(NativeCollapsibleTabsContent)
public final class NativeCollapsibleTabsContent: UIView, UIScrollViewDelegate, UIGestureRecognizerDelegate {

  // MARK: - Callbacks into the Fabric host

  @objc public var scrollViewResolver: ((UIView) -> UIScrollView?)?
  @objc public var onPageSelected: ((Int) -> Void)?
  @objc public var onCollapsedChange: ((Bool) -> Void)?
  @objc public var onRefresh: (() -> Void)?
  /// Provided by the host: cancels React's in-flight JS touches so a press
  /// under the finger never fires once a scroll or drag has begun.
  @objc public var cancelReactTouches: (() -> Void)?

  // MARK: - Native subviews

  private let pager = UIScrollView()
  private let headerSlot = UIView()
  private let tabBarSlot = UIView()
  private let spinner = UIActivityIndicatorView(style: .medium)
  private var pageSlots: [UIView] = []

  // MARK: - RN children

  private var headerChild: UIView?
  private var tabBarChild: UIView?
  private var pageChildren: [Int: UIView] = [:]

  // MARK: - Props

  private var headerHeight: CGFloat = 0
  private var tabBarHeight: CGFloat = 0
  private var pageCount = 0
  private var selectedIndex = 0
  private var collapseThreshold: CGFloat = 0
  private var swipeEnabled = true

  // MARK: - State

  private var headerOffset: CGFloat = 0
  private var pull: CGFloat = 0
  /// 'direction' collapse mode: the offset follows the scroll DELTA.
  private var directionMode = false
  /// Last seen offset of the active page (delta source for direction mode).
  private var lastActiveY: CGFloat = 0
  private var collapsed = false
  private var activeIndex = 0
  private var lastEmittedIndex = -1
  /// True between the user's horizontal drag start and the pager settling.
  private var userDragging = false

  /// Discovered scroll view per page, validated on use.
  private var pageScrollViews: [Int: WeakBox<UIScrollView>] = [:]
  /// Offsets a page still has to reach (lazy mount / growing content).
  private var pendingSync: [Int: CGFloat] = [:]
  private var contentSizeObservers: [Int: NSKeyValueObservation] = [:]
  private var giveUpWork: DispatchWorkItem?

  // Pull-to-refresh
  private var refreshing = false
  private weak var refreshHost: UIScrollView?
  private var refreshHostOriginalInset: CGFloat = 0

  // Header drag
  private var dragStartOffset: CGFloat = 0
  private var fling: FlingDriver?

  private static let refreshThreshold: CGFloat = 70
  private static let refreshBand: CGFloat = 60
  private static let syncGiveUp: TimeInterval = 0.4

  // MARK: - Init

  public override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true

    pager.isPagingEnabled = true
    pager.showsHorizontalScrollIndicator = false
    pager.showsVerticalScrollIndicator = false
    pager.alwaysBounceHorizontal = false
    pager.bounces = false
    pager.contentInsetAdjustmentBehavior = .never
    pager.delegate = self
    pager.delaysContentTouches = false
    addSubview(pager)

    spinner.hidesWhenStopped = false
    spinner.alpha = 0
    addSubview(spinner)

    addSubview(headerSlot)
    addSubview(tabBarSlot)

    for slot in [headerSlot, tabBarSlot] {
      let pan = UIPanGestureRecognizer(target: self, action: #selector(handleBandPan(_:)))
      pan.delegate = self
      pan.cancelsTouchesInView = false
      slot.addGestureRecognizer(pan)
    }
  }

  public required init?(coder: NSCoder) { nil }

  // MARK: - Props

  @objc public func setHeaderHeight(_ height: CGFloat) {
    guard height != headerHeight else { return }
    headerHeight = height
    headerOffset = min(headerOffset, headerHeight)
    setNeedsLayout()
    applyBandTransform()
  }

  @objc public func setTabBarHeight(_ height: CGFloat) {
    guard height != tabBarHeight else { return }
    tabBarHeight = height
    setNeedsLayout()
  }

  @objc public func setPageCount(_ count: Int) {
    guard count != pageCount else { return }
    pageCount = max(0, count)
    while pageSlots.count < pageCount {
      let slot = UIView()
      slot.clipsToBounds = true
      pager.addSubview(slot)
      pageSlots.append(slot)
      let index = pageSlots.count - 1
      if let child = pageChildren[index] { slot.addSubview(child) }
    }
    while pageSlots.count > pageCount {
      pageSlots.removeLast().removeFromSuperview()
    }
    setNeedsLayout()
  }

  @objc public func setSelectedIndex(_ index: Int) {
    selectedIndex = index
    scrollPager(to: index, animated: bounds.width > 0 && window != nil)
  }

  @objc public func setCollapseThreshold(_ threshold: CGFloat) {
    collapseThreshold = threshold
    updateCollapsed()
  }

  @objc public func setCollapseMode(_ mode: String) {
    directionMode = mode == "direction"
    // Re-anchor the delta tracker so the first scroll after a mode change
    // doesn't jump.
    lastActiveY = activeScrollView().map { adjustedY(of: $0) } ?? 0
  }

  @objc public func setSwipeEnabled(_ enabled: Bool) {
    swipeEnabled = enabled
    pager.isScrollEnabled = enabled
  }

  @objc public func setRefreshing(_ value: Bool) {
    if value {
      beginRefresh(emit: false)
    } else {
      endRefresh()
    }
  }

  // MARK: - RN children

  @objc public func mountChild(_ child: UIView, nativeId: String?, index: Int) {
    switch role(for: nativeId, index: index) {
    case .header:
      headerChild = child
      headerSlot.addSubview(child)
    case .tabBar:
      tabBarChild = child
      tabBarSlot.addSubview(child)
    case .page(let page):
      pageChildren[page] = child
      pageScrollViews[page] = nil
      if page < pageSlots.count { pageSlots[page].addSubview(child) }
      // Subtree is already mounted (Fabric inserts bottom-up), so the page's
      // list can be aligned to the header right away.
      if pendingSync[page] != nil { trySync(page) }
      if page == activeIndex { ensureActiveScrollViewObserved() }
    }
  }

  @objc public func unmountChild(_ child: UIView) {
    if headerChild === child { headerChild = nil }
    if tabBarChild === child { tabBarChild = nil }
    if let page = pageChildren.first(where: { $0.value === child })?.key {
      pageChildren[page] = nil
      pageScrollViews[page] = nil
      contentSizeObservers[page] = nil
      pendingSync[page] = nil
    }
    child.removeFromSuperview()
  }

  @objc public func reset() {
    headerChild?.removeFromSuperview()
    tabBarChild?.removeFromSuperview()
    pageChildren.values.forEach { $0.removeFromSuperview() }
    headerChild = nil
    tabBarChild = nil
    pageChildren.removeAll()
    pageScrollViews.removeAll()
    contentSizeObservers.removeAll()
    pendingSync.removeAll()
    fling?.stop()
    fling = nil
    refreshing = false
    refreshHost = nil
    headerOffset = 0
    pull = 0
    collapsed = false
    activeIndex = 0
    lastEmittedIndex = -1
    applyBandTransform()
  }

  private enum Role { case header, tabBar, page(Int) }

  private func role(for nativeId: String?, index: Int) -> Role {
    if let id = nativeId {
      if id == "tabs-header" { return .header }
      if id == "tabs-tabbar" { return .tabBar }
      if id.hasPrefix("tabs-page-"), let page = Int(id.dropFirst("tabs-page-".count)) {
        return .page(page)
      }
    }
    // Positional fallback: header, tab bar, pages…
    switch index {
    case 0: return .header
    case 1: return .tabBar
    default: return .page(index - 2)
    }
  }

  // MARK: - Layout

  public override func layoutSubviews() {
    super.layoutSubviews()
    let w = bounds.width
    let h = bounds.height
    pager.frame = bounds
    pager.contentSize = CGSize(width: w * CGFloat(pageCount), height: h)
    for (i, slot) in pageSlots.enumerated() {
      slot.frame = CGRect(x: CGFloat(i) * w, y: 0, width: w, height: h)
    }
    // bounds + center, never `frame`: the bands carry a translation
    // transform, and assigning `frame` to a transformed view re-centres it so
    // the *transformed* rect matches — silently undoing the collapse on every
    // layout pass (which UIKit runs constantly while a list scrolls).
    headerSlot.bounds = CGRect(x: 0, y: 0, width: w, height: headerHeight)
    headerSlot.center = CGPoint(x: w / 2, y: headerHeight / 2)
    tabBarSlot.bounds = CGRect(x: 0, y: 0, width: w, height: tabBarHeight)
    tabBarSlot.center = CGPoint(x: w / 2, y: headerHeight + tabBarHeight / 2)
    applyBandTransform()
    // Keep the pager on the selected page across size changes (rotation,
    // first layout): a paging scroll view does not re-snap by itself.
    if w > 0, pager.contentOffset.x != CGFloat(selectedIndex) * w, !userDragging {
      pager.contentOffset = CGPoint(x: CGFloat(selectedIndex) * w, y: 0)
    }
    if w > 0 { ensureActiveScrollViewObserved() }
  }

  private func applyBandTransform() {
    let ty = -headerOffset + pull
    let transform = CGAffineTransform(translationX: 0, y: ty)
    headerSlot.transform = transform
    tabBarSlot.transform = transform
    spinner.center = CGPoint(x: bounds.width / 2, y: max(pull, 0) / 2)
    if !refreshing {
      spinner.alpha = min(1, pull / Self.refreshThreshold)
      spinner.transform = CGAffineTransform(rotationAngle: pull / Self.refreshThreshold * .pi)
    }
  }

  // MARK: - Collapse engine

  /// Every observed scroll view reports here; only the active page drives.
  @objc public func handleScrollViewDidScroll(_ scrollView: UIScrollView) {
    if scrollView === pager {
      pagerDidScroll()
      return
    }
    guard scrollView === activeScrollView() else { return }
    let y = adjustedY(of: scrollView)
    let target: CGFloat
    if directionMode {
      // Follow the scroll DELTA: any up-scroll reveals the header, any
      // down-scroll hides it; pinned open at the very top. The offset only
      // ever grows at the content's own rate from the top, so
      // offset <= y holds and the content never leaves a gap under the
      // tab bar.
      let dy = y - lastActiveY
      target = y <= 0 ? 0 : min(max(headerOffset + dy, 0), headerHeight)
    } else {
      target = min(max(y, 0), headerHeight)
    }
    lastActiveY = y
    // While the active page is still catching up to the header (content
    // mounting), a clamped offset must not pop the header open.
    if pendingSync[activeIndex] != nil, target < headerOffset { return }
    pull = max(0, -y)
    setHeaderOffsetNow(target)
  }

  private func adjustedY(of scrollView: UIScrollView) -> CGFloat {
    scrollView.contentOffset.y + scrollView.contentInset.top - refreshInsetApplied(to: scrollView)
  }

  /// A page list started dragging: whatever React press was armed under the
  /// finger must not fire on release.
  @objc public func handleScrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    cancelReactTouches?()
  }

  @objc public func handleScrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate: Bool) {
    guard scrollView === activeScrollView() else { return }
    if !refreshing, pull >= Self.refreshThreshold {
      beginRefresh(emit: true)
    }
  }

  private func setHeaderOffsetNow(_ offset: CGFloat) {
    headerOffset = offset
    applyBandTransform()
    updateCollapsed()
  }

  private func animateHeaderOffset(to offset: CGFloat) {
    guard offset != headerOffset else { return }
    UIView.animate(withDuration: 0.2, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
      self.setHeaderOffsetNow(offset)
    }
  }

  private func updateCollapsed() {
    let next = headerOffset > collapseThreshold
    guard next != collapsed else { return }
    collapsed = next
    onCollapsedChange?(next)
  }

  // MARK: - Page scroll views

  private func scrollView(for page: Int) -> UIScrollView? {
    if let cached = pageScrollViews[page]?.value, cached.window != nil, isDescendant(cached, ofPage: page) {
      return cached
    }
    pageScrollViews[page] = nil
    guard let root = pageChildren[page], let found = scrollViewResolver?(root) else { return nil }
    pageScrollViews[page] = WeakBox(found)
    if contentSizeObservers[page] == nil {
      contentSizeObservers[page] = found.observe(\.contentSize, options: [.new]) { [weak self] _, _ in
        guard let self, self.pendingSync[page] != nil else { return }
        self.trySync(page)
      }
    }
    return found
  }

  private func isDescendant(_ view: UIView, ofPage page: Int) -> Bool {
    guard page < pageSlots.count else { return false }
    return view.isDescendant(of: pageSlots[page])
  }

  private func activeScrollView() -> UIScrollView? { scrollView(for: activeIndex) }

  /// Discovery is lazy (`scrollView(for:)`), and a page's list mounts a
  /// Fabric commit *after* its wrapper — so unless something resolved the
  /// active page's scroll view, a plain list scroll would never reach the
  /// collapse engine (the header only started following once a header pan
  /// forced the lookup). Resolve eagerly, retrying briefly for late mounts.
  private var discoveryRetries = 0

  private func ensureActiveScrollViewObserved(reset: Bool = true) {
    if reset { discoveryRetries = 0 }
    if activeScrollView() != nil { return }
    guard discoveryRetries < 30 else { return }
    discoveryRetries += 1
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
      self?.ensureActiveScrollViewObserved(reset: false)
    }
  }

  /// A neighbour must show its content at the height the header is at:
  /// fully collapsed → the page's own scroll, but never above the collapse
  /// point; otherwise exactly the header offset.
  private func syncPageToHeader(_ page: Int) {
    guard page >= 0, page < pageCount, page != activeIndex else { return }
    guard let sv = scrollView(for: page) else {
      pendingSync[page] = headerOffset
      return
    }
    let current = sv.contentOffset.y
    // Direction mode: a page only ever needs to be at least `offset` deep
    // (never scrolled back up to match). Classic: exact match below the
    // full-collapse point.
    let desired: CGFloat
    if directionMode {
      desired = max(current, headerOffset)
    } else {
      desired = headerOffset >= headerHeight ? max(current, headerHeight) : headerOffset
    }
    if current != desired { sv.contentOffset = CGPoint(x: sv.contentOffset.x, y: desired) }
    if sv.contentOffset.y < desired { pendingSync[page] = desired } else { pendingSync[page] = nil }
  }

  private func trySync(_ page: Int) {
    guard let desired = pendingSync[page], let sv = scrollView(for: page) else { return }
    if sv.contentOffset.y < desired {
      sv.contentOffset = CGPoint(x: sv.contentOffset.x, y: desired)
    }
    if sv.contentOffset.y >= desired {
      pendingSync[page] = nil
      if page == activeIndex { giveUpWork?.cancel() }
    } else if page == activeIndex {
      // Content may still be growing; give it a beat before conceding.
      giveUpWork?.cancel()
      let work = DispatchWorkItem { [weak self] in
        guard let self else { return }
        self.pendingSync[self.activeIndex] = nil
        self.reconcileHeaderToActive()
      }
      giveUpWork = work
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.syncGiveUp, execute: work)
    }
  }

  /// The page that became active decides the header; a page too short to
  /// hold the offset eases the header to what it can (Twitter behaviour).
  private func reconcileHeaderToActive() {
    guard let sv = activeScrollView() else {
      if headerOffset > 0 { pendingSync[activeIndex] = headerOffset }
      return
    }
    if pendingSync[activeIndex] != nil {
      trySync(activeIndex)
      if pendingSync[activeIndex] != nil { return }
    }
    let y = adjustedY(of: sv)
    lastActiveY = y
    let target: CGFloat
    if directionMode {
      // Only concede when the page cannot hold the current offset.
      target = y < headerOffset ? min(max(y, 0), headerHeight) : headerOffset
    } else {
      target = min(max(y, 0), headerHeight)
    }
    if target != headerOffset { animateHeaderOffset(to: target) }
  }

  // MARK: - Pager

  private func scrollPager(to index: Int, animated: Bool) {
    let w = bounds.width
    guard w > 0, index >= 0, index < max(pageCount, 1) else { return }
    let x = CGFloat(index) * w
    guard pager.contentOffset.x != x else {
      if activeIndex != index { activate(index) }
      return
    }
    pager.setContentOffset(CGPoint(x: x, y: 0), animated: animated)
    if !animated { activate(index) }
  }

  private func pagerDidScroll() {
    let w = bounds.width
    guard w > 0 else { return }
    let position = Int(floor(pager.contentOffset.x / w))
    syncPageToHeader(position)
    if pager.contentOffset.x - CGFloat(position) * w > 0 { syncPageToHeader(position + 1) }
  }

  private func activate(_ index: Int) {
    activeIndex = index
    selectedIndex = index
    ensureActiveScrollViewObserved()
    reconcileHeaderToActive()
    if lastEmittedIndex != index {
      lastEmittedIndex = index
      onPageSelected?(index)
    }
  }

  public func scrollViewDidScroll(_ scrollView: UIScrollView) {
    if scrollView === pager { pagerDidScroll() }
  }

  public func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    if scrollView === pager {
      userDragging = true
      cancelReactTouches?()
    }
  }

  public func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    guard scrollView === pager else { return }
    userDragging = false
    settlePager()
  }

  public func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    guard scrollView === pager, !decelerate else { return }
    userDragging = false
    settlePager()
  }

  public func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
    guard scrollView === pager else { return }
    settlePager()
  }

  private func settlePager() {
    let w = bounds.width
    guard w > 0 else { return }
    let index = Int((pager.contentOffset.x / w).rounded())
    activate(min(max(index, 0), max(pageCount - 1, 0)))
  }

  // MARK: - Pull to refresh

  private func refreshInsetApplied(to scrollView: UIScrollView) -> CGFloat {
    refreshing && refreshHost === scrollView ? Self.refreshBand : 0
  }

  private func beginRefresh(emit: Bool) {
    guard !refreshing else { return }
    refreshing = true
    spinner.alpha = 1
    spinner.transform = .identity
    spinner.startAnimating()
    if let sv = activeScrollView() {
      refreshHost = sv
      refreshHostOriginalInset = sv.contentInset.top
      sv.contentInset.top = refreshHostOriginalInset + Self.refreshBand
      // Hold the list open by the spinner band; the bands follow via `pull`.
      if sv.contentOffset.y > -Self.refreshBand, !sv.isDragging {
        sv.setContentOffset(CGPoint(x: sv.contentOffset.x, y: -Self.refreshBand), animated: true)
      }
    }
    if emit { onRefresh?() }
  }

  private func endRefresh() {
    guard refreshing else { return }
    refreshing = false
    spinner.stopAnimating()
    guard let sv = refreshHost else {
      pull = 0
      applyBandTransform()
      return
    }
    refreshHost = nil
    let original = refreshHostOriginalInset
    UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut]) {
      sv.contentInset.top = original
      if sv.contentOffset.y < 0, !sv.isDragging {
        sv.contentOffset = CGPoint(x: sv.contentOffset.x, y: 0)
      }
      self.spinner.alpha = 0
    }
  }

  // MARK: - Header drag → list scroll

  public override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
    let v = pan.velocity(in: self)
    // Header: any direction — vertical drags scroll the page, horizontal
    // ones are swallowed (inert by design, but they must still cancel the
    // press under the finger). Tab strip: vertical only, it scrolls itself
    // horizontally.
    if pan.view === headerSlot { return true }
    return abs(v.y) > abs(v.x) * 1.5
  }

  public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                                shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
    true
  }

  /// True while a horizontal header drag is being swallowed.
  private var swallowingPan = false

  @objc private func handleBandPan(_ pan: UIPanGestureRecognizer) {
    if pan.state == .began {
      let v = pan.velocity(in: self)
      swallowingPan = pan.view === headerSlot && abs(v.x) > abs(v.y) * 1.5
      if swallowingPan { cancelReactTouches?() }
    }
    if swallowingPan {
      if pan.state == .ended || pan.state == .cancelled { swallowingPan = false }
      return
    }
    guard let sv = activeScrollView() else { return }
    switch pan.state {
    case .began:
      cancelReactTouches?()
      fling?.stop()
      fling = nil
      sv.setContentOffset(sv.contentOffset, animated: false)
      dragStartOffset = sv.contentOffset.y
    case .changed:
      let raw = dragStartOffset - pan.translation(in: self).y
      sv.contentOffset = CGPoint(x: sv.contentOffset.x, y: clampForDrag(raw, in: sv))
    case .ended, .cancelled:
      let velocity = -pan.velocity(in: self).y
      if sv.contentOffset.y < 0 {
        if !refreshing, pull >= Self.refreshThreshold {
          beginRefresh(emit: true)
        } else if !refreshing {
          sv.setContentOffset(CGPoint(x: sv.contentOffset.x, y: 0), animated: true)
        }
      } else {
        startFling(sv, velocity: velocity)
      }
    default:
      break
    }
  }

  private func maxOffset(of sv: UIScrollView) -> CGFloat {
    max(0, sv.contentSize.height + sv.contentInset.bottom - sv.bounds.height)
  }

  private func clampForDrag(_ y: CGFloat, in sv: UIScrollView) -> CGFloat {
    if y < 0 { return y * 0.5 } // rubber band into the pull region
    return min(y, maxOffset(of: sv))
  }

  private func startFling(_ sv: UIScrollView, velocity: CGFloat) {
    guard abs(velocity) > 50 else { return }
    let driver = FlingDriver(velocity: velocity, maxOffset: maxOffset(of: sv)) { [weak sv] y in
      guard let sv else { return false }
      sv.contentOffset = CGPoint(x: sv.contentOffset.x, y: y)
      return true
    } offset: { [weak sv] in sv?.contentOffset.y ?? 0 }
    fling = driver
    driver.start()
  }
}

// MARK: - Helpers

private final class WeakBox<T: AnyObject> {
  weak var value: T?
  init(_ value: T) { self.value = value }
}

/// Deceleration for a header-driven drag: a `UIView` animation of
/// `contentOffset` would not fire the scroll delegate per frame (the header
/// would stop following), so the fling is stepped on a display link and each
/// step goes through the normal `contentOffset` setter. Uses UIScrollView's
/// normal deceleration rate so it feels like a native fling.
private final class FlingDriver: NSObject {
  private var velocity: CGFloat
  private let maxOffset: CGFloat
  private let apply: (CGFloat) -> Bool
  private let offset: () -> CGFloat
  private var link: CADisplayLink?
  private var lastTime: CFTimeInterval = 0
  private let rate = UIScrollView.DecelerationRate.normal.rawValue

  init(velocity: CGFloat, maxOffset: CGFloat, apply: @escaping (CGFloat) -> Bool, offset: @escaping () -> CGFloat) {
    self.velocity = velocity
    self.maxOffset = maxOffset
    self.apply = apply
    self.offset = offset
    super.init()
  }

  func start() {
    lastTime = CACurrentMediaTime()
    link = CADisplayLink(target: self, selector: #selector(tick))
    link?.add(to: .main, forMode: .common)
  }

  func stop() {
    link?.invalidate()
    link = nil
  }

  @objc private func tick(_ link: CADisplayLink) {
    let now = link.timestamp
    let dt = max(0, now - lastTime)
    lastTime = now
    let next = offset() + velocity * CGFloat(dt)
    velocity *= pow(rate, CGFloat(dt * 1000))
    let clamped = min(max(next, 0), maxOffset)
    if !apply(clamped) || clamped != next || abs(velocity) < 20 {
      stop()
    }
  }
}
