import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/organization-context';

export type PermissionType =
  | 'appointments_view'
  | 'appointments_create'
  | 'appointments_edit'
  | 'clients_view'
  | 'clients_create'
  | 'clients_edit'
  | 'professionals_view'
  | 'professionals_create'
  | 'professionals_edit'
  | 'services_view'
  | 'services_create'
  | 'services_edit'
  | 'analytics_view'
  | 'team_view'
  | 'inventory_view'
  | 'inventory_create'
  | 'inventory_edit'
  | 'finances_view'
  | 'finances_create';

export function usePermission(permission: PermissionType): boolean {
  const { currentOrganization, currentRole } = useOrganization();
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      if (!currentOrganization) {
        setHasPermission(false);
        return;
      }

      // Owner always has all permissions
      if (currentRole === 'owner') {
        setHasPermission(true);
        return;
      }

      // Check specific permission via RPC
      const { data, error } = await supabase.rpc('has_permission', {
        org_id: currentOrganization.id,
        _permission: permission,
      });

      if (error) {
        console.error('Error checking permission:', error);
        setHasPermission(false);
        return;
      }

      setHasPermission(data || false);
    };

    checkPermission();
  }, [currentOrganization, currentRole, permission]);

  return hasPermission;
}

export function usePermissions(permissions: PermissionType[]): Record<PermissionType, boolean> {
  const { currentOrganization, currentRole } = useOrganization();
  const [permissionMap, setPermissionMap] = useState<Record<PermissionType, boolean>>(
    () => Object.fromEntries(permissions.map(p => [p, false])) as Record<PermissionType, boolean>
  );

  useEffect(() => {
    const checkPermissions = async () => {
      if (!currentOrganization) {
        setPermissionMap(Object.fromEntries(permissions.map(p => [p, false])) as Record<PermissionType, boolean>);
        return;
      }

      // Owner always has all permissions
      if (currentRole === 'owner') {
        setPermissionMap(Object.fromEntries(permissions.map(p => [p, true])) as Record<PermissionType, boolean>);
        return;
      }

      // Check all permissions in parallel
      const results = await Promise.all(
        permissions.map(async (permission) => {
          const { data } = await supabase.rpc('has_permission', {
            org_id: currentOrganization.id,
            _permission: permission,
          });
          return [permission, data || false] as [PermissionType, boolean];
        })
      );

      setPermissionMap(Object.fromEntries(results) as Record<PermissionType, boolean>);
    };

    checkPermissions();
  }, [currentOrganization, currentRole, permissions.join(',')]);

  return permissionMap;
}
