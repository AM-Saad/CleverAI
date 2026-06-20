<template>
  <Menu as="div" class="relative inline-block text-left">
    <div>
      <MenuButton role="button"
        class="inline-flex w-full cursor-pointer justify-center gap-x-1.5 rounded-[var(--radius-xl)] border border-transparent text-sm font-semibold text-content-on-surface transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-surface-subtle focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]">
        <shared-icon name="user" class="w-8 h-8" />
      </MenuButton>
    </div>

    <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
      <MenuItems
        class="bg-surface border border-secondary absolute right-0 z-20 w-48 origin-top-right overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-dropdown)] dark:ring-white ring-opacity-5 focus:outline-none">
        <div class="overflow-hidden">
          <MenuItem v-slot="{ active }">
            <router-link to="/user/profile" tabindex="1" :class="[
              active ? 'bg-surface-strong text-content-on-surface-strong' : '',
              'flex items-center gap-3 p-sm text-sm text-content-on-surface',
            ]">
              <shared-icon :name="'user'" class="w-4 h-4" />

              My Account
            </router-link>
          </MenuItem>

          <MenuItem v-slot="{ active }">
            <router-link to="/workspaces" tabindex="2" :class="[
              active ? 'bg-surface-strong text-content-on-surface-strong' : '',
              'flex items-center gap-3 p-sm text-sm text-content-on-surface',
            ]">
              <shared-icon :name="'workspaces'" class="w-4 h-4" />
              Workspaces
            </router-link>
          </MenuItem>
          <MenuItem v-slot="{ active }">
            <router-link to="/user/settings" tabindex="2" :class="[
              active ? 'bg-surface-strong text-content-on-surface-strong' : '',
              'flex items-center gap-3 p-sm text-sm text-content-on-surface',
            ]">
              <shared-icon :name="'settings'" class="w-4 h-4" />
              Settings
            </router-link>
          </MenuItem>

          <MenuItem v-slot="{ active }">
            <a tabindex="3" :class="[
              active ? 'bg-error/10 text-error-text' : 'text-content-on-surface',
              'flex cursor-pointer items-center gap-3 p-sm text-sm',
            ]" @click.prevent="logout">
              <UIcon :name="'i-heroicons-arrow-right-on-rectangle'" class="w-4 h-4" />
              Sign out
            </a>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
// import logoGeek from "~/assets/images/logo-geek.png";

const { signOut, data } = useAuth();

const logout = async (): Promise<void> => {
  try {
    // Sign out without callback URL to prevent module loading issues
    await signOut({ redirect: false });

    // Use external redirect to fully reset the app state
    window.location.href = "/logout";
  } catch (error) {
    console.error("Logout error:", error);
    // Force redirect even on error
    window.location.href = "/logout";
  }
};

onMounted(() => {
  console.log(data.value?.user);
});
</script>
