<template>
  <Menu as="div" class="relative inline-block text-left">
    <div>
      <MenuButton role="button"
        class="inline-flex w-full border border-transparent justify-center gap-x-1.5 rounded-xl text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:hover:bg-transparent dark:hover:border-white transition-all duration-300 ease-in-out focus-visible:ring-1 ring-black dark:ring-white cursor-pointer">
        <img class="h-8 dark:invert-[1] dark:filter p-xs" src="~/assets/images/logo-geek.png" alt="" />
      </MenuButton>
    </div>

    <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
      <MenuItems
        class="bg-light dark:bg-darks absolute right-0 z-10 w-56 origin-top-right overflow-hidden rounded-xl shadow-lg dark:ring-white ring-opacity-5 focus:outline-none">
        <div class="overflow-hidden">
          <MenuItem v-slot="{ active }">
          <router-link to="/profile" tabindex="1" :class="[
            active ? 'bg-primary ' : '',
            'flex items-center gap-2 p-sm text-sm text-dark',
          ]">
            <UIcon :name="'i-heroicons-user'" class="w-4 h-4" />

            My Account
          </router-link>
          </MenuItem>

          <MenuItem v-slot="{ active }">
          <router-link to="/folders" tabindex="2" :class="[
            active ? 'bg-primary text-dark' : '',
            'flex items-center gap-2 p-sm text-sm text-dark',
          ]">
            <UIcon :name="'i-heroicons-folder-open'" class="w-4 h-4" />
            Folders
          </router-link>
          </MenuItem>
          <MenuItem v-slot="{ active }">
          <router-link to="/settings" tabindex="2" :class="[
            active ? 'bg-primary' : '',
            'flex items-center gap-2 p-sm text-sm text-dark',
          ]">
            <UIcon :name="'i-heroicons-cog-6-tooth'" class="w-4 h-4" />
            Settings
          </router-link>
          </MenuItem>

          <MenuItem v-slot="{ active }">
          <a tabindex="3" :class="[
            active ? 'bg-primary' : '',
            'flex items-center gap-2 p-sm text-sm text-dark',
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

const { signOut, data } = useAuth();

const logout = async (): Promise<void> => {
  await signOut({ callbackUrl: "/logout" });
};

onMounted(() => {
  console.log(data.value?.user);
});
</script>
