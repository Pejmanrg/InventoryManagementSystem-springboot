
(function (global) {
  'use strict';

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

  var ROLES = {
    FIELD: {
      key: 'FIELD',
      name: 'Warehouse / Field User',
      short: 'Field User',
      description: 'Check out, check in, move, and adjust stock.',
      can: [
        'dashboard.view', 'asset.view', 'asset.create', 'asset.checkout',
        'asset.checkin', 'asset.move', 'inventory.view', 'inventory.adjust',
        'report.view.basic'
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
        'report.view.basic', 'report.view.all', 'report.export',
        'audit.view'
      ]
    },
    FINANCE: {
      key: 'FINANCE',
      name: 'Purchasing / Finance',
      short: 'Purchasing',
      description: 'Read-only visibility with cost data and exports.',
      can: [
        'dashboard.view', 'asset.view', 'inventory.view',
        'report.view.basic', 'report.view.all', 'report.export',
        'audit.view'
      ]
    },
    ADMIN: {
      key: 'ADMIN',
      name: 'System Administrator',
      short: 'Administrator',
      description: 'User accounts, roles, lookup values, and audit records.',
      can: [
        'dashboard.view', 'asset.view', 'asset.create', 'asset.edit',
        'asset.checkout', 'asset.checkin', 'asset.move', 'asset.dispose',
        'asset.recover', 'inventory.view', 'inventory.adjust',
        'report.view.basic', 'report.view.all', 'report.export',
        'admin.view', 'admin.roles', 'admin.lookups',
        'audit.view', 'audit.export'
      ]
    }
  };


  // Filled in at runtime from GET /api/employees by API.reference.employees().
  var EMPLOYEES = [];

  // Filled in at runtime from GET /api/locations by API.reference.locations().
  // Deliberately empty: the ids that used to be here were prototype strings
  // like 'loc-100', and anything submitted from a dropdown built on them was
  // rejected by the API, which expects a UUID.
  var LOCATIONS = [];

  var CATEGORIES = [
    { code: 'IT',      name: 'IT Equipment' },
    { code: 'TOOL',    name: 'Power Tools' },
    { code: 'SAFETY',  name: 'Safety Equipment' },
    { code: 'VEHICLE', name: 'Company Vehicles' },
    { code: 'TEST',    name: 'Test Instruments' }
  ];

  var CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'NEEDS_SERVICE', 'DAMAGED'];





  var ADJUSTMENT_REASONS = [
    { code: 'ISSUE_TO_JOB', label: 'Issue to job / project' },
    { code: 'RECEIPT',      label: 'Receipt against purchase order' },
    { code: 'RETURN',       label: 'Return to stock' },
    { code: 'CYCLE_COUNT',  label: 'Cycle count correction' },
    { code: 'DAMAGE',       label: 'Damage / scrap' },
    { code: 'TRANSFER',     label: 'Transfer between locations' }
  ];





  global.MockData = {
    AssetStatus: AssetStatus,
    TransactionType: TransactionType,
    ROLES: ROLES,
    EMPLOYEES: EMPLOYEES,
    LOCATIONS: LOCATIONS,
    CATEGORIES: CATEGORIES,
    CONDITIONS: CONDITIONS,
    ADJUSTMENT_REASONS: ADJUSTMENT_REASONS
  };
})(window);
