// IMPORTANT: DO NOT DELETE OR EDIT THIS FILE
import React, { useState } from 'react'
import { Modal, SafeAreaView, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { DraggableFloatingButton } from './DraggableFloatingButton'
import { ChatScreen } from './ChatScreen'

const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID || ''

export function FloatingChatWrapper({ children }: { children: React.ReactNode }) {
  const [isModalVisible, setIsModalVisible] = useState(false)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}

      {/* Draggable floating chat button */}
      <DraggableFloatingButton onPress={() => setIsModalVisible(true)} />

      {/* Chat modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {isModalVisible && PROJECT_ID ? (
            <ChatScreen
              projectId={PROJECT_ID}
              onClose={() => setIsModalVisible(false)}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
})
