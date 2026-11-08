import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { AppIcon } from '../../components/ui/app-icon';
import { formatRupiahDisplay } from '../../utils/formatRupiah';
import { MenuItem, useMenuStore } from '../../stores/menuStore';
import { MenuFormModal } from '../../components/menu-form-modal';
import { CategoryManagementModal } from '../../components/category-management-modal';

export default function ExploreMenuScreen() {
  const db = useSQLiteContext();
  const {
    categories,
    menus,
    selectedCategoryId,
    searchQuery,
    isLoading,
    loadCategories,
    loadMenus,
    setSelectedCategoryId,
    setSearchQuery,
    deleteCategory,
    deleteMenu,
  } = useMenuStore();

  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  useEffect(() => {
    loadCategories(db);
    loadMenus(db);
  }, [db]);

  const filteredMenus = menus.filter((m) => {
    const matchesCat = selectedCategoryId === null || m.category_id === selectedCategoryId;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.barcode && m.barcode.includes(searchQuery));
    return matchesCat && matchesSearch;
  });

  const handleDeleteMenu = (m: MenuItem) => {
    Alert.alert(
      'Hapus Menu?',
      `Yakin ingin menghapus ${m.name} dari katalog menu angkringan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenu(db, m.id);
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Manajemen Katalog Menu</Text>
          <Text style={styles.headerSubtitle}>
            Kelola Nasi Kucing, Sate, Bakaran, Wedangan & Camilan
          </Text>
        </View>

        <View style={styles.headerRight}>
          <RealtimeClockBadge showDate={false} />
          <Button
            title="+ Kategori"
            variant="outline"
            size="sm"
            onPress={() => setCategoryModalVisible(true)}
            style={[styles.headerBtn, styles.headerOutlineBtn]}
            textStyle={styles.headerOutlineBtnText}
          />
          <Button
            title="+ Menu Baru"
            size="sm"
            onPress={() => {
              setEditingMenuItem(null);
              setMenuModalVisible(true);
            }}
            style={styles.headerBtn}
          />
        </View>
      </View>

      {/* Search Bar & Stats */}
      <View style={styles.topControlBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari menu berdasarkan nama atau scan barcode..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Horizontal Category Bar */}
      <View style={styles.catNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catNavContent}>
          <TouchableOpacity
            style={[styles.catNavBtn, selectedCategoryId === null && styles.catNavBtnActive]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.catNavText, selectedCategoryId === null && styles.catNavTextActive]}>
              Semua ({menus.length})
            </Text>
          </TouchableOpacity>

          {categories.map((c) => {
            const isSelected = selectedCategoryId === c.id;
            const count = menus.filter((m) => m.category_id === c.id).length;

            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.catNavBtn, isSelected && styles.catNavBtnActive]}
                onPress={() => setSelectedCategoryId(c.id)}
              >
                <Text style={[styles.catNavText, isSelected && styles.catNavTextActive]}>
                  {c.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.catNavAddBtn}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={styles.catNavAddText}>+ Kategori</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Menu Grid */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat menu...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredMenus}
            keyExtractor={(item) => item.id.toString()}
            numColumns={3}
            contentContainerStyle={styles.gridContainer}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Tidak ada menu yang sesuai.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.menuCard}>
                <View style={styles.cardTop}>
                  {item.image_path ? (
                    <Image source={{ uri: item.image_path }} style={styles.menuImg} />
                  ) : (
                    <View style={styles.placeholderImg}>
                      <AppIcon name="cart" size={24} color={Colors.textMuted} />
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.menuName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.menuPrice}>{formatRupiahDisplay(item.price)}</Text>
                    <View style={{ marginTop: 4 }}>
                      <Badge
                        label={
                          item.track_stock === 1
                            ? `Stok: ${item.stock}`
                            : 'Unlimited'
                        }
                        variant={
                          item.track_stock === 1 && item.stock <= 5
                            ? 'danger'
                            : 'neutral'
                        }
                        size="sm"
                      />
                    </View>
                  </View>
                </View>

                {/* Actions: Single unified Edit button and Hapus */}
                <View style={styles.cardActions}>
                  <Button
                    title="Edit"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setEditingMenuItem(item);
                      setMenuModalVisible(true);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Hapus"
                    variant="danger"
                    size="sm"
                    onPress={() => handleDeleteMenu(item)}
                  />
                </View>
              </Card>
            )}
          />
        )}
      </View>

      {/* Unified Menu Form Modal */}
      <MenuFormModal
        visible={menuModalVisible}
        menuItem={editingMenuItem}
        onClose={() => setMenuModalVisible(false)}
      />

      {/* Comprehensive Category Management Modal */}
      <CategoryManagementModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        onSelectCategory={(newId) => setSelectedCategoryId(newId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    borderColor: '#ffffff',
  },
  headerOutlineBtn: {
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerOutlineBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  topControlBar: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    height: 42,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  catNav: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catNavContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  catNavBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catNavBtnActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  catNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  catNavTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  catNavAddBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  catNavAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    padding: 12,
    gap: 12,
  },
  menuCard: {
    flex: 1,
    margin: 6,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  placeholderImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderImgText: {
    fontSize: 26,
  },
  menuName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  menuPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
