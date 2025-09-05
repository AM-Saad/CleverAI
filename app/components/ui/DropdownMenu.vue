<template>
    <Menu as="div" class="relative inline-block text-left">
        <div>
            <MenuButton
role="button"
                class="inline-flex w-full border border-transparent justify-center gap-x-1.5 rounded-xl text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:hover:bg-transparent dark:hover:border-white transition-all duration-300 ease-in-out focus-visible:ring-1 ring-black dark:ring-white cursor-pointer">
                <img class="h-8 dark:invert-[1] dark:filter p-xs" src="~/assets/images/logo-geek.png" alt="">
            </MenuButton>
        </div>

        <transition
enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95">
            <MenuItems
                class="bg-background dark:bg-foreground absolute right-0 z-10 w-56 origin-top-right overflow-hidden rounded-xl shadow-lg  dark:ring-white ring-opacity-5 focus:outline-none">
                <div class="overflow-hidden">
                    <MenuItem v-slot="{ active }">
                    <router-link
to="/profile" tabindex="1" :class="[
                        active
                            ? 'bg-accent text-gray-900 dark:text-gray-300 dark:bg-slate-600'
                            : 'text-gray-700 dark:text-gray-200',
                        'block p-sm text-sm',
                    ]">
                        My Profile
                    </router-link>
                    </MenuItem>

                    <MenuItem v-slot="{ active }">
                    <router-link
to="/folders" tabindex="2" :class="[
                        active
                            ? 'bg-accent text-gray-900 dark:text-gray-300 dark:bg-slate-600'
                            : 'text-gray-700 dark:text-gray-200',
                        'block p-sm text-sm',
                    ]">
                        Folders
                    </router-link>
                    </MenuItem>

                    <MenuItem v-slot="{ active }">
                    <a
tabindex="3" :class="[
                        active
                            ? 'bg-accent text-gray-900 dark:text-gray-300 dark:bg-slate-600'
                            : 'text-gray-700 dark:text-gray-200',
                        'block p-sm text-sm cursor-pointer',
                    ]" @click.prevent="logout">
                        Sign out
                    </a>
                    </MenuItem>

                </div>
            </MenuItems>
        </transition>
    </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue"

const { signOut, data } = useAuth()

const logout = async (): Promise<void> => {
    await signOut({ callbackUrl: "/logout" })
}

onMounted(() => {
    console.log(data.value?.user)
})
</script>
