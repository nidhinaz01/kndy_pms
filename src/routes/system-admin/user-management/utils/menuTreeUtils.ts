// Helper function to build menu tree
export function buildMenuTree(menuItems: any[]): any[] {
  const menuMap = new Map<string, any>();
  const rootMenus: any[] = [];

  // Create a map of all menu items
  menuItems.forEach(item => {
    menuMap.set(item.menu_id, { ...item, submenus: [] });
  });

  // Build the tree structure
  menuItems.forEach(item => {
    const menuItem = menuMap.get(item.menu_id)!;
    
    if (item.parent_menu_id && menuMap.has(item.parent_menu_id)) {
      // This is a submenu
      const parent = menuMap.get(item.parent_menu_id)!;
      if (!parent.submenus) parent.submenus = [];
      parent.submenus.push(menuItem);
    } else {
      // This is a root menu
      rootMenus.push(menuItem);
    }
  });

  return rootMenus;
}

// Helper function to get all leaf menus from tree
export function getLeafMenus(menuTree: any[]): any[] {
  const leafMenus: any[] = [];
  
  function traverse(menus: any[]) {
    menus.forEach(menu => {
      if (!menu.submenus || menu.submenus.length === 0) {
        // This is a leaf menu
        leafMenus.push(menu);
      } else {
        // This has submenus, traverse them
        traverse(menu.submenus);
      }
    });
  }
  
  traverse(menuTree);
  return leafMenus;
}

