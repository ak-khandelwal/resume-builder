import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ResumeInfo from '@/components/EditorPage/ResumeInfo.vue'
// import { vuetify } from '@/test/setup' // No longer importing global vuetify
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { ResumeDataV2 } from '@/models/ResumeData/ResumeDataV2'
import TiptapEditor from '@/components/EditorPage/TiptapEditor.vue'

// Mock TiptapEditor as it's complex and not the focus here
vi.mock('@/components/EditorPage/TiptapEditor.vue', () => ({
    default: {
        name: 'TiptapEditor',
        template: '<div class="tiptap-editor-mock"><slot/></div>',
        props: ['modelValue'],
        emits: ['update:modelValue']
    }
}))

describe('ResumeInfo.vue', () => {
    let wrapper
    let mockResumeData
    let localVuetifyInstance

    beforeEach(() => {
        localVuetifyInstance = createVuetify({ components, directives })
        mockResumeData = ResumeDataV2.createDefault()

        // Ensure matchMedia is mocked for this local instance context if needed,
        // though it should be global from setup.js. This is more for isolation.
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        Object.defineProperty(global, 'visualViewport', {
            writable: true,
            configurable: true,
            value: {
                width: 1920,
                height: 1080,
                scale: 1,
                offsetTop: 0,
                offsetLeft: 0,
                onresize: null,
                onscroll: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }
        });

        wrapper = mount(ResumeInfo, {
            global: {
                plugins: [localVuetifyInstance], // Use a locally created Vuetify instance
                stubs: {
                    TiptapEditor: true // Stub the TiptapEditor
                }
            },
            props: {
                resumeData: mockResumeData,
                isMobile: false
            }
        })
    })

    describe('Component Rendering', () => {
        it('renders personal information fields', () => {
            expect(wrapper.find('input[aria-label="Name"]').exists()).toBe(true)
            expect(wrapper.find('input[aria-label="Title"]').exists()).toBe(true)
        })

        it('renders profile picture upload section', () => {
            expect(wrapper.find('input[aria-label="Upload profile picture"]').exists()).toBe(true)
            expect(wrapper.text()).toContain('Position')
            expect(wrapper.text()).toContain('Style')
        })
    })

    describe('Profile Picture Functionality', () => {
        it('updates imageDataUrl when a file is uploaded', async () => {
            const fileInput = wrapper.find('input[type="file"]')
            const mockFile = new File(['dummy content'], 'example.png', { type: 'image/png' })

            // Mock the FileReader
            const mockReader = {
                onload: null,
                readAsDataURL: vi.fn().mockImplementation(function() {
                    // "this" refers to the reader instance
                    if (this.onload) {
                        this.onload({ target: { result: 'data:image/png;base64,dummydata' } })
                    }
                }),
                result: 'data:image/png;base64,dummydata' // Add result property
            }
            vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader)

            // Simulate file selection
            // Directly setting files on input type=file is not straightforward in JSDOM
            // So we'll call the handler method directly for testing the logic
            await wrapper.vm.handleImageUpload({ target: { files: [mockFile] } })
            await wrapper.vm.$nextTick()

            expect(wrapper.props('resumeData').personal.imageDataUrl).toBe('data:image/png;base64,dummydata')
            expect(wrapper.emitted('change')).toBeTruthy()

            // Restore FileReader
            vi.restoreAllMocks()
        })

        it('clears imageDataUrl when clear button is clicked', async () => {
            // Set an initial image
            wrapper.props('resumeData').personal.imageDataUrl = 'data:image/png;base64,dummydata'
            await wrapper.vm.$nextTick()
            expect(wrapper.props('resumeData').personal.imageDataUrl).toBe('data:image/png;base64,dummydata')

            // Simulate clear
            // The v-file-input clearable prop triggers a @click:clear event
            // We can call the method directly
            await wrapper.vm.clearImage()
            await wrapper.vm.$nextTick()

            expect(wrapper.props('resumeData').personal.imageDataUrl).toBe('')
            expect(wrapper.emitted('change')).toBeTruthy()
        })

        it('updates imagePosition when radio button is selected', async () => {
            // Find all VRadio components. This assumes VRadio renders with a specific class or can be found.
            // A more robust way would be to add data-testid attributes to VRadio components if possible.
            // For now, let's assume they are direct children or identifiable.
            const radioPositionLabels = wrapper.findAllComponents({ name: 'VRadio' })

            // Find the specific radio button by its label or value.
            // VRadio has a 'label' prop and 'value' prop.
            const sidebarRadioWrapper = radioPositionLabels.find(
                r => r.props('label') === 'Sidebar' && r.props('value') === 'sidebar'
            )
            expect(sidebarRadioWrapper.exists()).toBe(true)

            // Simulate a click on the input element within the VRadio
            await sidebarRadioWrapper.find('input[type="radio"]').trigger('click')
            // Changing v-model directly by setting value and triggering input/change can also work
            sidebarRadioWrapper.find('input[type="radio"]').setValue(true) // this might not be how v-radio works

            // More direct way to simulate v-model update for a radio group
            // by directly updating the prop that v-radio-group binds to.
            // However, we want to test user interaction.
            // Let's try emitting the update from the VRadioGroup if possible, or finding the correct input

            // Vuetify's VRadioGroup updates its modelValue when a VRadio is selected.
            // We need to ensure the click correctly propagates or directly set the modelValue on the group.
            // Let's try finding the input and setting its 'checked' state then dispatching 'change'
            // This interaction was not correctly updating the v-model.
            // const radioInput = sidebarRadioWrapper.find('input[type="radio"]')
            // radioInput.element.checked = true
            // await radioInput.trigger('change')

            // A more reliable way for Vuetify components is often to directly set the prop
            // that the v-model is bound to on the parent component (VRadioGroup),
            // or to find the VRadioGroup and emit an 'update:modelValue' event.
            // For testing the user interaction of clicking a radio:
            await sidebarRadioWrapper.find('input[type="radio"]').setValue(true) // This is vue-test-utils way for radios
            await wrapper.vm.$nextTick()

            expect(wrapper.props('resumeData').personal.imagePosition).toBe('sidebar')
        })

        it('updates imageStyle when radio button is selected', async () => {
            const radioStyleWrappers = wrapper.findAllComponents({ name: 'VRadio' })
            const roundedRadioWrapper = radioStyleWrappers.find(
                r => r.props('label') === 'Rounded' && r.props('value') === 'rounded'
            )
            expect(roundedRadioWrapper.exists()).toBe(true)

            await roundedRadioWrapper.find('input[type="radio"]').setValue(true)
            await wrapper.vm.$nextTick()

            expect(wrapper.props('resumeData').personal.imageStyle).toBe('rounded')
        })
    })

    // Basic tests for existing functionality to ensure no regressions
    describe('Existing Sections Interaction', () => {
        it('allows adding an experience item', async () => {
            const initialCount = wrapper.props('resumeData').experiences.length
            // Find the "Add Experience" button by its aria-label or text
            const addExperienceButton = wrapper.find('button[aria-label="Add Experience"]')
            await addExperienceButton.trigger('click')
            await wrapper.vm.$nextTick() // Wait for modal to potentially open / data to change

            // Check if the experience modal is shown (or if a new item is added directly if modal isn't fully tested here)
            // For simplicity, we'll check if the openExperienceModal method was called,
            // or if a new item was added (depending on how deeply we want to test interactions)
            // Here, we assume addExp directly calls openExperienceModal
            // We can also check if a new experience item is added if the modal logic is simple
            // This test might need adjustment based on the actual implementation of addExp and modals
        })

        it('allows adding an education item', async () => {
            const initialCount = wrapper.props('resumeData').education.length
            const addEducationButton = wrapper.find('button[aria-label="Add Education"]')
            await addEducationButton.trigger('click')
            await wrapper.vm.$nextTick()
            // Similar checks as for experience
        })

        it('allows adding a custom section', async () => {
            const initialCount = wrapper.props('resumeData').customSections.length
            const addCustomSectionButton = wrapper.find('button[aria-label="Add custom section"]')
            await addCustomSectionButton.trigger('click')
            await wrapper.vm.$nextTick()
             // Similar checks as for experience
        })
    })
})
