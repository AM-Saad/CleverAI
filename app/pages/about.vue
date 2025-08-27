<template>
    <div>
        <div class="wrapper">
            <section id="about">
                <h2>About us</h2>
                <p></p>
            </section>

            <section id="services" class="my-5 p-5">
                <h2 class="my-5 text-2xl font-bold">Why Choose us</h2>

                <div class="grid gap-5 sm:grid-cols-2">
                    <div class="services-item  relative overflow-hidden filter">
                        <div class="relative z-10">
                            <div class="head">
                                <div class="icon">
                                    <img class="h-2/4" src="~/assets/images/free.png" alt="" srcset="" />
                                </div>
                                <h5>Free</h5>
                            </div>
                            <p>
                                You don't need to pay anything, no credit card required.<br /><strong>
                                    Enjoy it now</strong>
                            </p>
                        </div>
                    </div>

                    <div class="services-item  relative overflow-hidden filter">
                        <div class="relative z-10">
                            <div class="head">
                                <div class="icon">
                                    <img class="h-2/4" src="~/assets/images/nodown.png" alt="" srcset="" />
                                </div>
                                <h5>Online(No Downlaod Required)</h5>
                            </div>
                            <p>
                                START is all that it takes, however, since it's a PWA you could
                                install it to make it available on your computer
                            </p>
                        </div>
                    </div>

                    <div class="services-item  relative overflow-hidden filter">
                        <div class="relative z-10">
                            <div class="head">
                                <div class="icon">
                                    <img class="h-2/4" src="~/assets/images/screen.png" alt="" srcset="" />
                                    />
                                </div>
                                <h5>Flexable</h5>
                            </div>
                            <p>Whether you want ..</p>
                        </div>
                    </div>

                    <div class="services-item  relative overflow-hidden filter">
                        <div class="relative z-10">
                            <div class="head">
                                <div class="icon">
                                    <img class="h-2/4" src="~/assets/images/mic.png" alt="" srcset="" />
                                    />
                                </div>
                                <h5>Options</h5>
                            </div>
                            <p>options to control your ..</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script>
definePageMeta({
    auth: false,
})

export default {
    name: "Home",
}
</script>

<style scoped>
footer {
    position: relative;
    z-index: 1;
    background-color: #333;
    background-image: url(/images/footer.svg);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center center;
}

.footer-wrapper {
    font-size: 20px;
}

.footer-wrapper>div {
    margin: var(--l-margin) var(--m-margin);
}

.footer-social ul {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: var(--l-margin);
}

.footer-social ul li {
    margin-right: var(--l-margin);
}

.footer-wrapper ul li a {
    color: #fff;
    transition: 0.3s;
    text-decoration: none;
    font-size: 30px;
}

.footer-wrapper ul li a:hover {
    color: var(--main-color);
}

.footer-contact p {
    color: #fff;
    margin: var(--s-margin);
}

@media only screen and (max-width: 768px) {
    .header-intro p {
        margin: var(--s-margin);
        font-size: 17px;
    }

    section h2 {
        font-size: 30px;
    }

    section#signup p {
        font-size: 22px;
    }

    .footer-wrapper ul li a {
        font-size: 18px;
    }

    .footer-social ul {
        margin: var(--m-margin) var(--s-margin);
    }
}
</style>
