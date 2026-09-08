/* ==========================================================================
   data.js - Mock dataset for the front-end prototype
   --------------------------------------------------------------------------
   PROTOTYPE ONLY. Every object in this file is shaped like the JSON payload
   the future Spring Boot REST API is expected to return, so the mock layer in
   api.js can be swapped for real `fetch()` calls without changing any screen.

   Field names deliberately mirror the Java domain model in
   com.solarintegrators.inventory.model:
     Asset            -> assetId, tag, name, status, locationId, custodianEmployeeId
     InventoryItem    -> inventoryItemId, sku, description, quantityOnHand, locationId
     AssetTransaction -> transactionId, assetId, type, employeeId, timestamp, notes
     AssetStatus      -> AVAILABLE | CHECKED_OUT | MAINTENANCE | LOST | RETIRED
     TransactionType  -> CHECKOUT | CHECKIN | MOVE | DISPOSE | RECOVER
   ========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- enums */

  var AssetStatus = {
    AVAILABLE: 'AVAILABLE',
    CHECKED_OUT: 'CHECKED_OUT',
    MAINTENANCE: 'MAINTENANCE',
    LOST: 'LOST',
    RETIRED: 'RETIRED'
  };

  var TransactionType = {
    CHECKOUT: 'CHECKOUT',
    CHECKIN: 'CHECKIN',
    MOVE: 'MOVE',
    DISPOSE: 'DISPOSE',
    RECOVER: 'RECOVER'
  };

  /* ---------------------------------------------------------------- roles */
  /* Role keys match the planned Entra ID role claims (CSC-09 Identity &
     Access). `can` lists the capability strings checked by Auth.can(). */

  var ROLES = {
    FIELD: {
      key: 'FIELD',
      name: 'Warehouse / Field User',
      short: 'Field User',
      description: 'Scan, check out, check in, move, and receive equipment.',
      can: [
        'dashboard.view', 'asset.view', 'asset.create', 'asset.checkout',
        'asset.checkin', 'asset.move', 'inventory.view', 'inventory.adjust',
        'maintenance.view', 'maintenance.create', 'report.view.basic'
      ]
    },
    MANAGER: {
      key: 'MANAGER',
      name: 'Manager / Supervisor',
      short: 'Manager',
      description: 'Full operational visibility across sites, plus approvals.',
      can: [
        'dashboard.view', 'asset.view', 'asset.create', 'asset.edit',
        'asset.checkout', 'asset.checkin', 'asset.move', 'asset.dispose',
        'asset.recover', 'inventory.view', 'inventory.adjust',
        'maintenance.view', 'maintenance.create', 'maintenance.close',
        'report.view.basic', 'report.view.all', 'report.export',
        'audit.view'
      ]
    },
    FINANCE: {
      key: 'FINANCE',
      name: 'Purchasing / Finance',
      short: 'Purchasing',
      description: 'Purchase orders, receiving, cost data, and exports.',
      can: [
        'dashboard.view', 'asset.view', 'inventory.view',
        'maintenance.view', 'purchasing.view', 'purchasing.receive',
        'report.view.basic', 'report.view.all', 'report.export',
        'audit.view'
      ]
    },
    ADMIN: {
      key: 'ADMIN',
      name: 'System Administrator',
      short: 'Administrator',
      description: 'Roles, lookup values, integrations, and audit records.',
      can: [
        'dashboard.view', 'asset.view', 'asset.create', 'asset.edit',
        'asset.checkout', 'asset.checkin', 'asset.move', 'asset.dispose',
        'asset.recover', 'inventory.view', 'inventory.adjust',
        'maintenance.view', 'maintenance.create', 'maintenance.close',
        'purchasing.view', 'purchasing.receive',
        'report.view.basic', 'report.view.all', 'report.export',
        'admin.view', 'admin.roles', 'admin.lookups', 'admin.integrations',
        'audit.view', 'audit.export'
      ]
    }
  };

  /* ------------------------------------------------------------ demo users */
  /* Prototype sign-in accounts. Production authentication is delegated to
     Microsoft Entra ID (OIDC) - see SDD section 2.1.1, CSC-09. */

  var USERS = [
    { userId: 'usr-1001', name: 'Maria Alvarez',  email: 'malvarez@example-solar.com',  role: 'FIELD',   employeeId: 'emp-2001', site: 'San Diego Warehouse', status: 'ACTIVE',   lastSignIn: '2026-09-05T15:42:00' },
    { userId: 'usr-1002', name: 'Dana Nguyen',    email: 'dnguyen@example-solar.com',   role: 'MANAGER', employeeId: 'emp-2002', site: 'San Diego Warehouse', status: 'ACTIVE',   lastSignIn: '2026-09-06T07:10:00' },
    { userId: 'usr-1003', name: 'Chris Boone',    email: 'cboone@example-solar.com',    role: 'FINANCE', employeeId: 'emp-2003', site: 'Corporate Office',    status: 'ACTIVE',   lastSignIn: '2026-09-05T17:05:00' },
    { userId: 'usr-1004', name: 'Priya Raman',    email: 'praman@example-solar.com',    role: 'ADMIN',   employeeId: 'emp-2004', site: 'Corporate Office',    status: 'ACTIVE',   lastSignIn: '2026-09-06T06:55:00' },
    { userId: 'usr-1005', name: 'Tyler Reed',     email: 'treed@example-solar.com',     role: 'FIELD',   employeeId: 'emp-2005', site: 'Otay Mesa Yard',      status: 'ACTIVE',   lastSignIn: '2026-09-04T13:20:00' },
    { userId: 'usr-1006', name: 'Sam Ortiz',      email: 'sortiz@example-solar.com',    role: 'FIELD',   employeeId: 'emp-2006', site: 'Riverside Solar Site',status: 'ACTIVE',   lastSignIn: '2026-09-05T11:02:00' },
    { userId: 'usr-1007', name: 'Jordan Wells',   email: 'jwells@example-solar.com',    role: 'MANAGER', employeeId: 'emp-2007', site: 'Otay Mesa Yard',      status: 'ACTIVE',   lastSignIn: '2026-09-03T09:48:00' },
    { userId: 'usr-1008', name: 'Alex Moreno',    email: 'amoreno@example-solar.com',   role: 'FIELD',   employeeId: 'emp-2008', site: 'San Diego Warehouse', status: 'DISABLED', lastSignIn: '2026-07-22T08:15:00' }
  ];

  /* ------------------------------------------------------- employee lookup */
  /* Synchronised inbound from the HR platform through CSC-13 (read-only
     inside this application). */

  var EMPLOYEES = [
    { employeeId: 'emp-2001', externalHrId: 'HR-4471', name: 'Maria Alvarez', title: 'Lead Field Technician', site: 'San Diego Warehouse',  status: 'ACTIVE' },
    { employeeId: 'emp-2002', externalHrId: 'HR-4402', name: 'Dana Nguyen',   title: 'Warehouse Supervisor',  site: 'San Diego Warehouse',  status: 'ACTIVE' },
    { employeeId: 'emp-2003', externalHrId: 'HR-4310', name: 'Chris Boone',   title: 'Purchasing Analyst',    site: 'Corporate Office',     status: 'ACTIVE' },
    { employeeId: 'emp-2004', externalHrId: 'HR-4288', name: 'Priya Raman',   title: 'Systems Administrator', site: 'Corporate Office',     status: 'ACTIVE' },
    { employeeId: 'emp-2005', externalHrId: 'HR-4519', name: 'Tyler Reed',    title: 'Installer II',          site: 'Otay Mesa Yard',       status: 'ACTIVE' },
    { employeeId: 'emp-2006', externalHrId: 'HR-4523', name: 'Sam Ortiz',     title: 'Field Technician',      site: 'Riverside Solar Site', status: 'ACTIVE' },
    { employeeId: 'emp-2007', externalHrId: 'HR-4390', name: 'Jordan Wells',  title: 'Construction Manager',  site: 'Otay Mesa Yard',       status: 'ACTIVE' },
    { employeeId: 'emp-2009', externalHrId: 'HR-4602', name: 'Rosa Delgado',  title: 'Installer I',           site: 'Riverside Solar Site', status: 'ACTIVE' },
    { employeeId: 'emp-2010', externalHrId: 'HR-4611', name: 'Ben Whitaker',  title: 'Service Technician',    site: 'San Diego Warehouse',  status: 'ACTIVE' }
  ];

  /* ------------------------------------------------------------- locations */

  var LOCATIONS = [
    { locationId: 'loc-100', code: 'WH-SD',    name: 'San Diego Warehouse',  type: 'WAREHOUSE', address: '2210 Kettner Blvd, San Diego, CA' },
    { locationId: 'loc-200', code: 'YD-OTAY',  name: 'Otay Mesa Yard',       type: 'YARD',      address: '8410 Airway Rd, San Diego, CA' },
    { locationId: 'loc-300', code: 'VAN-12',   name: 'Van 12 (Mobile)',      type: 'VEHICLE',   address: 'Mobile - assigned crew' },
    { locationId: 'loc-400', code: 'SITE-RIV', name: 'Riverside Solar Site', type: 'JOB_SITE',  address: '1400 Iowa Ave, Riverside, CA' },
    { locationId: 'loc-500', code: 'HQ',       name: 'Corporate Office',     type: 'OFFICE',    address: '5030 Camino Ruiz, San Diego, CA' },
    { locationId: 'loc-600', code: 'VAN-07',   name: 'Van 07 (Mobile)',      type: 'VEHICLE',   address: 'Mobile - assigned crew' }
  ];

  var CATEGORIES = [
    { code: 'IT',      name: 'IT Equipment' },
    { code: 'TOOL',    name: 'Power Tools' },
    { code: 'SAFETY',  name: 'Safety Equipment' },
    { code: 'VEHICLE', name: 'Company Vehicles' },
    { code: 'TEST',    name: 'Test Instruments' }
  ];

  var CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'NEEDS_SERVICE', 'DAMAGED'];

  /* ---------------------------------------------------------------- assets */
  /* Uniquely tagged assets (Asset.java). Fields beyond the current Java model
     - category, condition, serialNumber, purchase data - are part of the
     target design in SDD section 2 and are flagged in the README. */

  var ASSETS = [
    { assetId: 'ast-0001', tag: 'IT-10042',  name: 'Panasonic Toughbook FZ-55',        category: 'IT',      serialNumber: 'FZ55-8842119',  status: AssetStatus.CHECKED_OUT, locationId: 'loc-300', custodianEmployeeId: 'emp-2001', condition: 'GOOD',          purchaseDate: '2024-03-18', purchaseCost: 3120.00, warrantyEnd: '2027-03-18', lastTransactionAt: '2026-09-05T07:12:00', notes: 'Primary field laptop for the PV commissioning crew.' },
    { assetId: 'ast-0002', tag: 'IT-10043',  name: 'Panasonic Toughbook FZ-55',        category: 'IT',      serialNumber: 'FZ55-8842137',  status: AssetStatus.AVAILABLE,   locationId: 'loc-100', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2024-03-18', purchaseCost: 3120.00, warrantyEnd: '2027-03-18', lastTransactionAt: '2026-08-29T16:40:00', notes: '' },
    { assetId: 'ast-0003', tag: 'IT-10088',  name: 'iPad Pro 11" Field Tablet',        category: 'IT',      serialNumber: 'DMPX2LL2K1',    status: AssetStatus.CHECKED_OUT, locationId: 'loc-400', custodianEmployeeId: 'emp-2006', condition: 'GOOD',          purchaseDate: '2025-01-09', purchaseCost: 1099.00, warrantyEnd: '2027-01-09', lastTransactionAt: '2026-09-02T06:55:00', notes: 'Assigned for Riverside punch-list photos.' },
    { assetId: 'ast-0004', tag: 'IT-10011',  name: 'Dell Latitude 5540',               category: 'IT',      serialNumber: 'DL5540-77120',  status: AssetStatus.RETIRED,     locationId: 'loc-500', custodianEmployeeId: null,      condition: 'DAMAGED',       purchaseDate: '2021-06-02', purchaseCost: 1450.00, warrantyEnd: '2024-06-02', lastTransactionAt: '2026-06-14T10:05:00', notes: 'Retired after screen failure; disposed through e-waste vendor.' },
    { assetId: 'ast-0005', tag: 'IT-10099',  name: 'Zebra ZQ520 Label Printer',        category: 'IT',      serialNumber: 'ZQ520-44192',   status: AssetStatus.AVAILABLE,   locationId: 'loc-100', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2025-05-21', purchaseCost: 780.00,  warrantyEnd: '2027-05-21', lastTransactionAt: '2026-08-18T09:30:00', notes: 'Used for asset tag printing at receiving.' },

    { assetId: 'ast-0006', tag: 'VEH-204',   name: 'Ford Transit 250 Cargo Van',       category: 'VEHICLE', serialNumber: '1FTBR1C8XPKA1204', status: AssetStatus.CHECKED_OUT, locationId: 'loc-300', custodianEmployeeId: 'emp-2001', condition: 'GOOD',        purchaseDate: '2023-02-11', purchaseCost: 48250.00, warrantyEnd: '2026-02-11', lastTransactionAt: '2026-09-05T06:30:00', notes: 'Van 12 crew vehicle. Registration renews in November.' },
    { assetId: 'ast-0007', tag: 'VEH-207',   name: 'Ford F-250 Service Truck',         category: 'VEHICLE', serialNumber: '1FT7W2BT5NEC207', status: AssetStatus.MAINTENANCE, locationId: 'loc-200', custodianEmployeeId: null,      condition: 'NEEDS_SERVICE', purchaseDate: '2022-08-04', purchaseCost: 62400.00, warrantyEnd: '2025-08-04', lastTransactionAt: '2026-09-01T08:00:00', notes: 'In shop for brake service - see work order WO-2026-0139.' },
    { assetId: 'ast-0008', tag: 'VEH-211',   name: 'Chevrolet Silverado 2500',         category: 'VEHICLE', serialNumber: '1GC4YPE71PF211',  status: AssetStatus.AVAILABLE,   locationId: 'loc-200', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2024-11-30', purchaseCost: 58900.00, warrantyEnd: '2027-11-30', lastTransactionAt: '2026-08-27T15:12:00', notes: '' },

    { assetId: 'ast-0009', tag: 'TOOL-3312', name: 'Milwaukee M18 Hammer Drill',       category: 'TOOL',    serialNumber: 'MW18-330912',   status: AssetStatus.AVAILABLE,   locationId: 'loc-100', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2025-02-14', purchaseCost: 289.00,  warrantyEnd: '2030-02-14', lastTransactionAt: '2026-09-04T16:22:00', notes: '' },
    { assetId: 'ast-0010', tag: 'TOOL-3315', name: 'Milwaukee M18 Impact Driver',      category: 'TOOL',    serialNumber: 'MW18-331544',   status: AssetStatus.CHECKED_OUT, locationId: 'loc-400', custodianEmployeeId: 'emp-2009', condition: 'GOOD',          purchaseDate: '2025-02-14', purchaseCost: 249.00,  warrantyEnd: '2030-02-14', lastTransactionAt: '2026-09-03T06:48:00', notes: '' },
    { assetId: 'ast-0011', tag: 'TOOL-3401', name: 'Hilti TE 60 Rotary Hammer',        category: 'TOOL',    serialNumber: 'HT60-220188',   status: AssetStatus.MAINTENANCE, locationId: 'loc-100', custodianEmployeeId: null,      condition: 'NEEDS_SERVICE', purchaseDate: '2023-09-27', purchaseCost: 1420.00, warrantyEnd: '2025-09-27', lastTransactionAt: '2026-08-31T14:15:00', notes: 'Chuck slipping under load; sent for factory service.' },
    { assetId: 'ast-0012', tag: 'TOOL-3455', name: 'DeWalt 14" Chop Saw',              category: 'TOOL',    serialNumber: 'DW872-91044',   status: AssetStatus.AVAILABLE,   locationId: 'loc-200', custodianEmployeeId: null,      condition: 'FAIR',          purchaseDate: '2022-05-19', purchaseCost: 469.00,  warrantyEnd: '2025-05-19', lastTransactionAt: '2026-08-20T11:00:00', notes: '' },
    { assetId: 'ast-0013', tag: 'TOOL-2990', name: 'Honda EU2200i Generator',          category: 'TOOL',    serialNumber: 'EU22-771903',   status: AssetStatus.AVAILABLE,   locationId: 'loc-200', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2024-07-08', purchaseCost: 1199.00, warrantyEnd: '2027-07-08', lastTransactionAt: '2026-08-15T07:35:00', notes: '' },

    { assetId: 'ast-0014', tag: 'SAF-2201',  name: 'Fall Arrest Harness Kit',          category: 'SAFETY',  serialNumber: 'FAH-220118',    status: AssetStatus.AVAILABLE,   locationId: 'loc-100', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2025-04-02', purchaseCost: 340.00,  warrantyEnd: '2030-04-02', lastTransactionAt: '2026-09-01T06:20:00', notes: 'Next inspection due 2026-10-02.' },
    { assetId: 'ast-0015', tag: 'SAF-2202',  name: 'Fall Arrest Harness Kit',          category: 'SAFETY',  serialNumber: 'FAH-220231',    status: AssetStatus.LOST,        locationId: 'loc-400', custodianEmployeeId: 'emp-2006', condition: 'GOOD',          purchaseDate: '2025-04-02', purchaseCost: 340.00,  warrantyEnd: '2030-04-02', lastTransactionAt: '2026-08-26T17:44:00', notes: 'Reported missing from Riverside site container. Search in progress.' },
    { assetId: 'ast-0016', tag: 'SAF-2250',  name: 'Arc Flash PPE Kit 40 cal',         category: 'SAFETY',  serialNumber: 'AF40-559021',   status: AssetStatus.CHECKED_OUT, locationId: 'loc-400', custodianEmployeeId: 'emp-2010', condition: 'GOOD',          purchaseDate: '2024-10-16', purchaseCost: 1875.00, warrantyEnd: '2029-10-16', lastTransactionAt: '2026-09-04T05:58:00', notes: '' },

    { assetId: 'ast-0017', tag: 'TEST-1180', name: 'Fluke 1587 Insulation Tester',     category: 'TEST',    serialNumber: 'FL1587-30291',  status: AssetStatus.AVAILABLE,   locationId: 'loc-100', custodianEmployeeId: null,      condition: 'GOOD',          purchaseDate: '2024-01-23', purchaseCost: 1180.00, warrantyEnd: '2027-01-23', lastTransactionAt: '2026-08-30T13:05:00', notes: 'Calibration due 2027-01-15.' },
    { assetId: 'ast-0018', tag: 'TEST-1195', name: 'Seaward PV210 Solar Tester',       category: 'TEST',    serialNumber: 'SW210-88410',   status: AssetStatus.CHECKED_OUT, locationId: 'loc-300', custodianEmployeeId: 'emp-2005', condition: 'GOOD',          purchaseDate: '2025-06-11', purchaseCost: 2340.00, warrantyEnd: '2028-06-11', lastTransactionAt: '2026-09-05T06:35:00', notes: '' }
  ];

  /* ------------------------------------------------------- inventory items */
  /* Quantity-managed stock (InventoryItem.java). reorderPoint supports
     InventoryService.setThreshold() and the Low Stock report (CSC-06). */

  var INVENTORY = [
    { inventoryItemId: 'inv-0001', sku: 'SOL-MC4-100',  description: 'MC4 Connector Pair, 1000V',        category: 'Electrical',  uom: 'PR', quantityOnHand: 450,  reorderPoint: 200, unitCost: 1.85,  locationId: 'loc-100', lastCountedAt: '2026-08-31' },
    { inventoryItemId: 'inv-0002', sku: 'SOL-MC4-BRK',  description: 'MC4 Branch Connector Y, 2-to-1',   category: 'Electrical',  uom: 'EA', quantityOnHand: 96,   reorderPoint: 60,  unitCost: 6.40,  locationId: 'loc-100', lastCountedAt: '2026-08-31' },
    { inventoryItemId: 'inv-0003', sku: 'WIR-PV-10BLK', description: 'PV Wire 10 AWG, Black',            category: 'Wire',        uom: 'FT', quantityOnHand: 4200, reorderPoint: 2000,unitCost: 0.62,  locationId: 'loc-100', lastCountedAt: '2026-09-01' },
    { inventoryItemId: 'inv-0004', sku: 'WIR-PV-10RED', description: 'PV Wire 10 AWG, Red',              category: 'Wire',        uom: 'FT', quantityOnHand: 1850, reorderPoint: 2000,unitCost: 0.62,  locationId: 'loc-100', lastCountedAt: '2026-09-01' },
    { inventoryItemId: 'inv-0005', sku: 'RAIL-IR-168',  description: 'IronRidge XR-100 Rail, 168 in',    category: 'Racking',     uom: 'EA', quantityOnHand: 240,  reorderPoint: 120, unitCost: 38.75, locationId: 'loc-200', lastCountedAt: '2026-08-28' },
    { inventoryItemId: 'inv-0006', sku: 'CLMP-MID',     description: 'IronRidge Mid Clamp, Black',       category: 'Racking',     uom: 'EA', quantityOnHand: 1120, reorderPoint: 800, unitCost: 2.10,  locationId: 'loc-200', lastCountedAt: '2026-08-28' },
    { inventoryItemId: 'inv-0007', sku: 'CLMP-END',     description: 'IronRidge End Clamp, Black',       category: 'Racking',     uom: 'EA', quantityOnHand: 180,  reorderPoint: 400, unitCost: 2.35,  locationId: 'loc-200', lastCountedAt: '2026-08-28' },
    { inventoryItemId: 'inv-0008', sku: 'FLASH-QM',     description: 'QuickMount QBase Flashing',        category: 'Mounting',    uom: 'EA', quantityOnHand: 60,   reorderPoint: 150, unitCost: 14.90, locationId: 'loc-100', lastCountedAt: '2026-08-25' },
    { inventoryItemId: 'inv-0009', sku: 'SAF-GLV-CL0',  description: 'Class 0 Rubber Insulating Gloves', category: 'Safety',      uom: 'PR', quantityOnHand: 24,   reorderPoint: 12,  unitCost: 96.00, locationId: 'loc-100', lastCountedAt: '2026-09-02' },
    { inventoryItemId: 'inv-0010', sku: 'CONS-BIT-14',  description: '1/4 in Impact Bits, 10-pack',      category: 'Consumables', uom: 'PK', quantityOnHand: 38,   reorderPoint: 20,  unitCost: 12.25, locationId: 'loc-200', lastCountedAt: '2026-08-19' },
    { inventoryItemId: 'inv-0011', sku: 'BREAK-60A',    description: '60A Breaker, 2-pole',              category: 'Electrical',  uom: 'EA', quantityOnHand: 12,   reorderPoint: 25,  unitCost: 44.00, locationId: 'loc-100', lastCountedAt: '2026-09-03' },
    { inventoryItemId: 'inv-0012', sku: 'LBL-ASSET',    description: 'Asset Tag Labels, QR, roll of 100',category: 'Consumables', uom: 'EA', quantityOnHand: 900,  reorderPoint: 300, unitCost: 0.34,  locationId: 'loc-100', lastCountedAt: '2026-08-11' },
    { inventoryItemId: 'inv-0013', sku: 'CONS-SEAL',    description: 'Roof Sealant Tube, 10 oz',         category: 'Consumables', uom: 'EA', quantityOnHand: 0,    reorderPoint: 40,  unitCost: 8.75,  locationId: 'loc-200', lastCountedAt: '2026-09-04' }
  ];

  /* ----------------------------------------------------- asset transactions */
  /* AssetTransaction.java records. Preserved history - never overwritten
     (SDD design constraint: Reliable transaction history). */

  var TRANSACTIONS = [
    { transactionId: 'txn-0001', assetId: 'ast-0001', type: TransactionType.CHECKOUT, employeeId: 'emp-2001', timestamp: '2026-09-05T07:12:00', notes: 'Checked out for Riverside commissioning week.',      locationId: 'loc-300', performedBy: 'usr-1002' },
    { transactionId: 'txn-0002', assetId: 'ast-0001', type: TransactionType.CHECKIN,  employeeId: 'emp-2001', timestamp: '2026-08-29T16:05:00', notes: 'Returned in good condition. Battery at 60%.',       locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0003', assetId: 'ast-0001', type: TransactionType.CHECKOUT, employeeId: 'emp-2001', timestamp: '2026-08-24T06:40:00', notes: 'Weekly crew assignment.',                            locationId: 'loc-300', performedBy: 'usr-1001' },
    { transactionId: 'txn-0004', assetId: 'ast-0001', type: TransactionType.MOVE,     employeeId: 'emp-2002', timestamp: '2026-08-12T10:18:00', notes: 'Transferred from Corporate Office to SD Warehouse.', locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0005', assetId: 'ast-0006', type: TransactionType.CHECKOUT, employeeId: 'emp-2001', timestamp: '2026-09-05T06:30:00', notes: 'Van 12 assigned for the week.',                      locationId: 'loc-300', performedBy: 'usr-1002' },
    { transactionId: 'txn-0006', assetId: 'ast-0003', type: TransactionType.CHECKOUT, employeeId: 'emp-2006', timestamp: '2026-09-02T06:55:00', notes: 'Punch-list documentation.',                          locationId: 'loc-400', performedBy: 'usr-1007' },
    { transactionId: 'txn-0007', assetId: 'ast-0010', type: TransactionType.CHECKOUT, employeeId: 'emp-2009', timestamp: '2026-09-03T06:48:00', notes: 'Racking install crew.',                              locationId: 'loc-400', performedBy: 'usr-1007' },
    { transactionId: 'txn-0008', assetId: 'ast-0016', type: TransactionType.CHECKOUT, employeeId: 'emp-2010', timestamp: '2026-09-04T05:58:00', notes: 'Service call - MSP upgrade.',                        locationId: 'loc-400', performedBy: 'usr-1002' },
    { transactionId: 'txn-0009', assetId: 'ast-0018', type: TransactionType.CHECKOUT, employeeId: 'emp-2005', timestamp: '2026-09-05T06:35:00', notes: 'IV curve testing at Riverside.',                     locationId: 'loc-300', performedBy: 'usr-1007' },
    { transactionId: 'txn-0010', assetId: 'ast-0015', type: TransactionType.CHECKOUT, employeeId: 'emp-2006', timestamp: '2026-08-20T06:15:00', notes: 'Issued for roof work.',                              locationId: 'loc-400', performedBy: 'usr-1007' },
    { transactionId: 'txn-0011', assetId: 'ast-0011', type: TransactionType.MOVE,     employeeId: 'emp-2002', timestamp: '2026-08-31T14:15:00', notes: 'Moved to service bench - chuck slipping.',           locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0012', assetId: 'ast-0007', type: TransactionType.MOVE,     employeeId: 'emp-2007', timestamp: '2026-09-01T08:00:00', notes: 'Sent to fleet shop for brake service.',              locationId: 'loc-200', performedBy: 'usr-1007' },
    { transactionId: 'txn-0013', assetId: 'ast-0004', type: TransactionType.DISPOSE,  employeeId: 'emp-2004', timestamp: '2026-06-14T10:05:00', notes: 'E-waste disposal, certificate #EW-88213.',           locationId: 'loc-500', performedBy: 'usr-1004' },
    { transactionId: 'txn-0014', assetId: 'ast-0009', type: TransactionType.CHECKIN,  employeeId: 'emp-2005', timestamp: '2026-09-04T16:22:00', notes: 'Returned. Case and two batteries included.',         locationId: 'loc-100', performedBy: 'usr-1001' },
    { transactionId: 'txn-0015', assetId: 'ast-0012', type: TransactionType.CHECKIN,  employeeId: 'emp-2009', timestamp: '2026-08-20T11:00:00', notes: 'Blade worn - flagged for replacement.',              locationId: 'loc-200', performedBy: 'usr-1007' },
    { transactionId: 'txn-0016', assetId: 'ast-0013', type: TransactionType.CHECKIN,  employeeId: 'emp-2005', timestamp: '2026-08-15T07:35:00', notes: 'Fuel topped off before storage.',                    locationId: 'loc-200', performedBy: 'usr-1001' },
    { transactionId: 'txn-0017', assetId: 'ast-0002', type: TransactionType.CHECKIN,  employeeId: 'emp-2010', timestamp: '2026-08-29T16:40:00', notes: 'Returned after training session.',                   locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0018', assetId: 'ast-0014', type: TransactionType.CHECKIN,  employeeId: 'emp-2001', timestamp: '2026-09-01T06:20:00', notes: 'Inspected - passed visual check.',                   locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0019', assetId: 'ast-0017', type: TransactionType.CHECKIN,  employeeId: 'emp-2006', timestamp: '2026-08-30T13:05:00', notes: 'Returned with calibration certificate.',             locationId: 'loc-100', performedBy: 'usr-1002' },
    { transactionId: 'txn-0020', assetId: 'ast-0008', type: TransactionType.CHECKIN,  employeeId: 'emp-2007', timestamp: '2026-08-27T15:12:00', notes: 'Returned to yard. Fuel 3/4.',                        locationId: 'loc-200', performedBy: 'usr-1007' }
  ];

  /* ------------------------------------------------ inventory adjustments */
  /* Quantity movements for InventoryItem records. Kept separate from
     AssetTransaction because TransactionType in the Java model applies to
     tagged assets only - see README "Design notes for the team". */

  var ADJUSTMENTS = [
    { adjustmentId: 'adj-0001', inventoryItemId: 'inv-0001', delta: -50,  reason: 'ISSUE_TO_JOB',   reference: 'JOB-2291 Riverside', quantityAfter: 450,  timestamp: '2026-09-05T08:20:00', performedBy: 'usr-1001', notes: 'Issued to Riverside array string work.' },
    { adjustmentId: 'adj-0002', inventoryItemId: 'inv-0011', delta: -8,   reason: 'ISSUE_TO_JOB',   reference: 'JOB-2288 Vista MSP', quantityAfter: 12,   timestamp: '2026-09-03T09:05:00', performedBy: 'usr-1001', notes: '' },
    { adjustmentId: 'adj-0003', inventoryItemId: 'inv-0003', delta: 2000, reason: 'RECEIPT',        reference: 'PO-8841',            quantityAfter: 4200, timestamp: '2026-09-01T11:45:00', performedBy: 'usr-1003', notes: 'Received against PO-8841 line 2.' },
    { adjustmentId: 'adj-0004', inventoryItemId: 'inv-0007', delta: -120, reason: 'ISSUE_TO_JOB',   reference: 'JOB-2291 Riverside', quantityAfter: 180,  timestamp: '2026-08-30T07:30:00', performedBy: 'usr-1005', notes: '' },
    { adjustmentId: 'adj-0005', inventoryItemId: 'inv-0008', delta: -15,  reason: 'DAMAGE',         reference: '',                   quantityAfter: 60,   timestamp: '2026-08-25T14:10:00', performedBy: 'usr-1002', notes: 'Crushed in transit - vendor claim filed.' },
    { adjustmentId: 'adj-0006', inventoryItemId: 'inv-0013', delta: -40,  reason: 'ISSUE_TO_JOB',   reference: 'JOB-2280 Escondido', quantityAfter: 0,    timestamp: '2026-09-04T06:50:00', performedBy: 'usr-1005', notes: 'Depleted - reorder submitted.' },
    { adjustmentId: 'adj-0007', inventoryItemId: 'inv-0006', delta: 400,  reason: 'RECEIPT',        reference: 'PO-8836',            quantityAfter: 1120, timestamp: '2026-08-28T10:15:00', performedBy: 'usr-1003', notes: '' },
    { adjustmentId: 'adj-0008', inventoryItemId: 'inv-0009', delta: -2,   reason: 'CYCLE_COUNT',    reference: 'CC-2026-09',         quantityAfter: 24,   timestamp: '2026-09-02T16:00:00', performedBy: 'usr-1002', notes: 'Count variance corrected.' }
  ];

  var ADJUSTMENT_REASONS = [
    { code: 'ISSUE_TO_JOB', label: 'Issue to job / project' },
    { code: 'RECEIPT',      label: 'Receipt against purchase order' },
    { code: 'RETURN',       label: 'Return to stock' },
    { code: 'CYCLE_COUNT',  label: 'Cycle count correction' },
    { code: 'DAMAGE',       label: 'Damage / scrap' },
    { code: 'TRANSFER',     label: 'Transfer between locations' }
  ];

  /* ------------------------------------------------------------ work orders */
  /* MaintenanceService (CSC-05): createWorkOrder, updateWorkOrder,
     closeWorkOrder. */

  var WORK_ORDERS = [
    { workOrderId: 'wo-0001', number: 'WO-2026-0139', assetId: 'ast-0007', title: 'Front brake service and rotor replacement', type: 'CORRECTIVE', priority: 'HIGH',   status: 'IN_PROGRESS', assignedTo: 'emp-2010', vendor: 'Otay Fleet Services', openedAt: '2026-09-01T08:05:00', dueDate: '2026-09-09', closedAt: null, estimatedCost: 1450.00, notes: 'Vehicle out of service until complete.' },
    { workOrderId: 'wo-0002', number: 'WO-2026-0141', assetId: 'ast-0011', title: 'Hilti TE 60 chuck slipping - factory service', type: 'CORRECTIVE', priority: 'MEDIUM', status: 'OPEN',        assignedTo: 'emp-2002', vendor: 'Hilti Service Center', openedAt: '2026-08-31T14:20:00', dueDate: '2026-09-14', closedAt: null, estimatedCost: 380.00,  notes: 'RMA number pending.' },
    { workOrderId: 'wo-0003', number: 'WO-2026-0142', assetId: 'ast-0014', title: 'Annual fall-arrest harness inspection',      type: 'PREVENTIVE', priority: 'MEDIUM', status: 'OPEN',        assignedTo: 'emp-2002', vendor: 'In-house',            openedAt: '2026-09-02T09:00:00', dueDate: '2026-10-02', closedAt: null, estimatedCost: 0.00,    notes: 'Competent-person inspection required before reissue.' },
    { workOrderId: 'wo-0004', number: 'WO-2026-0138', assetId: 'ast-0017', title: 'Fluke 1587 annual calibration',              type: 'PREVENTIVE', priority: 'LOW',    status: 'ON_HOLD',     assignedTo: 'emp-2004', vendor: 'Transcat',            openedAt: '2026-08-18T13:00:00', dueDate: '2027-01-15', closedAt: null, estimatedCost: 210.00,  notes: 'Scheduled with calibration vendor for January window.' },
    { workOrderId: 'wo-0005', number: 'WO-2026-0130', assetId: 'ast-0006', title: 'Van 12 - 30,000 mile service',               type: 'PREVENTIVE', priority: 'MEDIUM', status: 'CLOSED',      assignedTo: 'emp-2010', vendor: 'Otay Fleet Services', openedAt: '2026-07-11T08:30:00', dueDate: '2026-07-25', closedAt: '2026-07-22T15:40:00', estimatedCost: 640.00, notes: 'Oil, filters, tire rotation completed.' },
    { workOrderId: 'wo-0006', number: 'WO-2026-0126', assetId: 'ast-0012', title: 'Chop saw blade replacement',                 type: 'CORRECTIVE', priority: 'LOW',    status: 'CLOSED',      assignedTo: 'emp-2005', vendor: 'In-house',            openedAt: '2026-08-20T11:20:00', dueDate: '2026-08-27', closedAt: '2026-08-24T09:10:00', estimatedCost: 68.00,  notes: 'Blade replaced from stock.' }
  ];

  /* ----------------------------------------------------- purchase orders */
  /* Synchronised inbound from the accounting/ERP platform through CSC-13.
     Read-only in this prototype; receiving posts back a receipt status. */

  var PURCHASE_ORDERS = [
    { poId: 'po-0001', number: 'PO-8841', vendor: 'CED Greentech',   status: 'PARTIALLY_RECEIVED', orderedAt: '2026-08-24', expectedAt: '2026-09-08', total: 6840.00, lines: 3, receivedLines: 2, project: 'JOB-2291 Riverside' },
    { poId: 'po-0002', number: 'PO-8836', vendor: 'IronRidge',       status: 'RECEIVED',           orderedAt: '2026-08-14', expectedAt: '2026-08-28', total: 3120.00, lines: 2, receivedLines: 2, project: 'JOB-2288 Vista' },
    { poId: 'po-0003', number: 'PO-8850', vendor: 'Grainger',        status: 'OPEN',               orderedAt: '2026-09-02', expectedAt: '2026-09-12', total: 1490.00, lines: 4, receivedLines: 0, project: 'Stock replenishment' },
    { poId: 'po-0004', number: 'PO-8853', vendor: 'Fastenal',        status: 'OPEN',               orderedAt: '2026-09-04', expectedAt: '2026-09-15', total: 880.00,  lines: 2, receivedLines: 0, project: 'Stock replenishment' }
  ];

  /* ------------------------------------------------------- audit events */
  /* AuditService.recordEvent / searchEvents / exportAudit (CSC-12). Every
     inventory-changing action and security event lands here. */

  var AUDIT = [
    { eventId: 'aud-0001', timestamp: '2026-09-06T07:10:22', actor: 'usr-1002', action: 'AUTH_SIGN_IN',       entityType: 'USER',      entityId: 'usr-1002', summary: 'Signed in through Microsoft Entra ID.',                    outcome: 'SUCCESS', ip: '10.20.4.18' },
    { eventId: 'aud-0002', timestamp: '2026-09-05T08:20:41', actor: 'usr-1001', action: 'INVENTORY_ADJUST',   entityType: 'INVENTORY', entityId: 'inv-0001', summary: 'SOL-MC4-100 adjusted by -50 (500 -> 450), JOB-2291.',     outcome: 'SUCCESS', ip: '10.20.9.55' },
    { eventId: 'aud-0003', timestamp: '2026-09-05T07:12:09', actor: 'usr-1002', action: 'ASSET_CHECKOUT',     entityType: 'ASSET',     entityId: 'ast-0001', summary: 'IT-10042 checked out to Maria Alvarez.',                   outcome: 'SUCCESS', ip: '10.20.4.18' },
    { eventId: 'aud-0004', timestamp: '2026-09-05T06:35:12', actor: 'usr-1007', action: 'ASSET_CHECKOUT',     entityType: 'ASSET',     entityId: 'ast-0018', summary: 'TEST-1195 checked out to Tyler Reed.',                     outcome: 'SUCCESS', ip: '10.20.7.31' },
    { eventId: 'aud-0005', timestamp: '2026-09-05T06:30:44', actor: 'usr-1002', action: 'ASSET_CHECKOUT',     entityType: 'ASSET',     entityId: 'ast-0006', summary: 'VEH-204 checked out to Maria Alvarez.',                    outcome: 'SUCCESS', ip: '10.20.4.18' },
    { eventId: 'aud-0006', timestamp: '2026-09-04T16:22:55', actor: 'usr-1001', action: 'ASSET_CHECKIN',      entityType: 'ASSET',     entityId: 'ast-0009', summary: 'TOOL-3312 checked in at San Diego Warehouse.',             outcome: 'SUCCESS', ip: '10.20.9.55' },
    { eventId: 'aud-0007', timestamp: '2026-09-04T11:03:17', actor: 'usr-1005', action: 'ASSET_CHECKOUT',     entityType: 'ASSET',     entityId: 'ast-0011', summary: 'Checkout rejected - asset status is MAINTENANCE.',         outcome: 'DENIED',  ip: '10.20.7.90' },
    { eventId: 'aud-0008', timestamp: '2026-09-04T06:50:03', actor: 'usr-1005', action: 'INVENTORY_ADJUST',   entityType: 'INVENTORY', entityId: 'inv-0013', summary: 'CONS-SEAL adjusted by -40 (40 -> 0), JOB-2280.',           outcome: 'SUCCESS', ip: '10.20.7.90' },
    { eventId: 'aud-0009', timestamp: '2026-09-03T09:05:31', actor: 'usr-1001', action: 'INVENTORY_ADJUST',   entityType: 'INVENTORY', entityId: 'inv-0011', summary: 'BREAK-60A adjusted by -8 (20 -> 12), JOB-2288.',           outcome: 'SUCCESS', ip: '10.20.9.55' },
    { eventId: 'aud-0010', timestamp: '2026-09-02T09:00:12', actor: 'usr-1002', action: 'WORKORDER_CREATE',   entityType: 'WORKORDER', entityId: 'wo-0003',  summary: 'WO-2026-0142 opened for SAF-2201.',                        outcome: 'SUCCESS', ip: '10.20.4.18' },
    { eventId: 'aud-0011', timestamp: '2026-09-02T08:41:29', actor: 'usr-1004', action: 'ROLE_ASSIGN',        entityType: 'USER',      entityId: 'usr-1006', summary: 'Sam Ortiz granted role Warehouse / Field User.',           outcome: 'SUCCESS', ip: '10.20.1.7'  },
    { eventId: 'aud-0012', timestamp: '2026-09-01T11:45:08', actor: 'usr-1003', action: 'PO_RECEIVE',         entityType: 'PO',        entityId: 'po-0001',  summary: 'PO-8841 line 2 received - 2000 FT PV wire.',               outcome: 'SUCCESS', ip: '10.20.1.44' },
    { eventId: 'aud-0013', timestamp: '2026-09-01T08:05:44', actor: 'usr-1007', action: 'ASSET_STATUS_CHANGE',entityType: 'ASSET',     entityId: 'ast-0007', summary: 'VEH-207 status changed AVAILABLE -> MAINTENANCE.',         outcome: 'SUCCESS', ip: '10.20.7.31' },
    { eventId: 'aud-0014', timestamp: '2026-08-31T22:10:00', actor: 'system',   action: 'INTEGRATION_SYNC',   entityType: 'INTEGRATION',entityId:'int-hr',    summary: 'HR employee sync completed - 9 records, 0 errors.',        outcome: 'SUCCESS', ip: '-' },
    { eventId: 'aud-0015', timestamp: '2026-08-31T14:20:36', actor: 'usr-1002', action: 'WORKORDER_CREATE',   entityType: 'WORKORDER', entityId: 'wo-0002',  summary: 'WO-2026-0141 opened for TOOL-3401.',                       outcome: 'SUCCESS', ip: '10.20.4.18' },
    { eventId: 'aud-0016', timestamp: '2026-08-30T18:02:11', actor: 'usr-1008', action: 'AUTH_SIGN_IN',       entityType: 'USER',      entityId: 'usr-1008', summary: 'Sign-in blocked - account disabled.',                      outcome: 'DENIED',  ip: '73.44.19.201' },
    { eventId: 'aud-0017', timestamp: '2026-08-28T10:15:52', actor: 'usr-1003', action: 'INVENTORY_ADJUST',   entityType: 'INVENTORY', entityId: 'inv-0006', summary: 'CLMP-MID adjusted by +400 (720 -> 1120), PO-8836.',        outcome: 'SUCCESS', ip: '10.20.1.44' },
    { eventId: 'aud-0018', timestamp: '2026-08-26T17:44:19', actor: 'usr-1007', action: 'ASSET_STATUS_CHANGE',entityType: 'ASSET',     entityId: 'ast-0015', summary: 'SAF-2202 reported LOST at Riverside Solar Site.',          outcome: 'SUCCESS', ip: '10.20.7.31' },
    { eventId: 'aud-0019', timestamp: '2026-08-24T09:33:05', actor: 'usr-1004', action: 'BULK_IMPORT',        entityType: 'ASSET',     entityId: 'batch-77', summary: 'Asset import preview - 42 rows, 3 duplicates skipped.',    outcome: 'SUCCESS', ip: '10.20.1.7'  },
    { eventId: 'aud-0020', timestamp: '2026-06-14T10:05:27', actor: 'usr-1004', action: 'ASSET_DISPOSE',      entityType: 'ASSET',     entityId: 'ast-0004', summary: 'IT-10011 disposed - e-waste certificate EW-88213.',        outcome: 'SUCCESS', ip: '10.20.1.7'  }
  ];

  /* ------------------------------------------------------- integrations */
  /* External Integration Gateway (CSC-13). Status is mocked. */

  var INTEGRATIONS = [
    { id: 'int-entra',   name: 'Microsoft Entra ID',      direction: 'Inbound', purpose: 'SSO, role claims (OIDC)',                        status: 'CONNECTED',  lastSync: '2026-09-06T07:00:00', owner: 'IT' },
    { id: 'int-hr',      name: 'HR Platform',             direction: 'Inbound / Outbound', purpose: 'Employee sync; assignment + return events', status: 'CONNECTED', lastSync: '2026-08-31T22:10:00', owner: 'HR' },
    { id: 'int-erp',     name: 'Accounting / ERP',        direction: 'Inbound / Outbound', purpose: 'Open POs in; receipt status out',           status: 'CONNECTED', lastSync: '2026-09-05T23:30:00', owner: 'Finance' },
    { id: 'int-billing', name: 'Project / Billing',       direction: 'Outbound', purpose: 'Allocation and shipment events',                 status: 'NOT_CONFIGURED', lastSync: null,               owner: 'Finance' }
  ];

  /* ------------------------------------------------------------- exports */

  global.MockData = {
    AssetStatus: AssetStatus,
    TransactionType: TransactionType,
    ROLES: ROLES,
    USERS: USERS,
    EMPLOYEES: EMPLOYEES,
    LOCATIONS: LOCATIONS,
    CATEGORIES: CATEGORIES,
    CONDITIONS: CONDITIONS,
    ASSETS: ASSETS,
    INVENTORY: INVENTORY,
    TRANSACTIONS: TRANSACTIONS,
    ADJUSTMENTS: ADJUSTMENTS,
    ADJUSTMENT_REASONS: ADJUSTMENT_REASONS,
    WORK_ORDERS: WORK_ORDERS,
    PURCHASE_ORDERS: PURCHASE_ORDERS,
    AUDIT: AUDIT,
    INTEGRATIONS: INTEGRATIONS
  };
})(window);
